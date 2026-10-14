import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RegisterSchema, LoginSchema, UpdateProfileSchema } from '@sideband/contracts';
import { registerUser, loginUser, revokeSession, getUserById, validateSession } from './service.js';
import { getDb } from '../db/index.js';
import { isAllowedOrigin } from './origin.js';

const COOKIE_NAME = 'sideband_session';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: false, // HTTP for local; set true in production HTTPS
};

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
interface RateLimitEntry {
  count: number;
  expiresAt: number;
}
const rateLimits = new Map<string, RateLimitEntry>();

export function resetRateLimits(): void {
  rateLimits.clear();
}

export function checkRateLimit(ip: string, maxRequests = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || entry.expiresAt <= now) {
    rateLimits.set(ip, { count: 1, expiresAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

// ─── Origin Verification ───────────────────────────────────────────────────────
export function verifyOrigin(req: FastifyRequest, reply: FastifyReply): boolean {
  const origin = req.headers.origin;
  if (origin && !isAllowedOrigin(origin)) {
    reply.status(403).send({ error: { code: 'FORBIDDEN_ORIGIN', message: 'Untrusted origin' } });
    return false;
  }
  return true;
}

export function getSessionToken(req: FastifyRequest): string | undefined {
  return req.cookies?.[COOKIE_NAME];
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = getSessionToken(req);
  if (!token) {
    reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }
  const db = getDb();
  const session = validateSession(db, token);
  if (!session) {
    reply.clearCookie(COOKIE_NAME, COOKIE_OPTS);
    reply.status(401).send({ error: { code: 'SESSION_EXPIRED', message: 'Session expired or invalid' } });
    return;
  }
  (req as FastifyRequest & { userId: string; sessionId: string }).userId = session.userId;
  (req as FastifyRequest & { userId: string; sessionId: string }).sessionId = session.sessionId;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  // Origin check for all mutating auth requests
  app.addHook('preHandler', async (req, reply) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      if (!verifyOrigin(req, reply)) {
        return reply;
      }
    }
  });

  // POST /api/v1/auth/register
  app.post('/api/v1/auth/register', async (req, reply) => {
    const ip = req.ip || '127.0.0.1';
    if (!checkRateLimit(ip)) {
      return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many registration requests' } });
    }

    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' } });
    }

    const db = getDb();
    try {
      const user = await registerUser(db, parsed.data.username, parsed.data.displayName, parsed.data.password);
      const { token } = await loginUser(db, user.username, parsed.data.password);
      reply.setCookie(COOKIE_NAME, token, COOKIE_OPTS);
      return reply.status(201).send({
        data: { id: user.id, username: user.username, displayName: user.displayName, avatarColor: user.avatarColor }
      });
    } catch (err: unknown) {
      const e = err as { code?: string; status?: number; message?: string };
      return reply.status(e.status ?? 500).send({ error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Registration failed' } });
    }
  });

  // POST /api/v1/auth/login
  app.post('/api/v1/auth/login', async (req, reply) => {
    const ip = req.ip || '127.0.0.1';
    if (!checkRateLimit(ip)) {
      return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many login requests' } });
    }

    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    }

    const db = getDb();
    try {
      const { token, userId } = await loginUser(db, parsed.data.username, parsed.data.password);
      const user = getUserById(db, userId);
      reply.setCookie(COOKIE_NAME, token, COOKIE_OPTS);
      return reply.send({
        data: { id: user!.id, username: user!.username, displayName: user!.display_name, avatarColor: user!.avatar_color }
      });
    } catch (err: unknown) {
      const e = err as { code?: string; status?: number; message?: string };
      return reply.status(e.status ?? 500).send({ error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Login failed' } });
    }
  });

  // POST /api/v1/auth/logout
  app.post('/api/v1/auth/logout', { preHandler: requireAuth }, async (req, reply) => {
    const authReq = req as FastifyRequest & { sessionId: string };
    const db = getDb();
    revokeSession(db, authReq.sessionId);
    reply.clearCookie(COOKIE_NAME, COOKIE_OPTS);
    return reply.send({ data: { ok: true } });
  });

  // GET /api/v1/auth/me
  app.get('/api/v1/auth/me', { preHandler: requireAuth }, async (req, reply) => {
    const authReq = req as FastifyRequest & { userId: string };
    const db = getDb();
    const user = getUserById(db, authReq.userId);
    if (!user) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    const memberships = db.prepare(`
      SELECT sm.space_id, sm.role, s.name as space_name, s.slug, s.icon_text
      FROM space_members sm
      JOIN spaces s ON s.id = sm.space_id
      WHERE sm.user_id = ?
    `).all(authReq.userId) as { space_id: string; role: string; space_name: string; slug: string; icon_text: string }[];

    return reply.send({
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatarColor: user.avatar_color,
        createdAt: user.created_at,
        memberships: memberships.map(m => ({
          spaceId: m.space_id,
          role: m.role,
          spaceName: m.space_name,
          slug: m.slug,
          iconText: m.icon_text,
        })),
      }
    });
  });

  // PATCH /api/v1/auth/me
  app.patch('/api/v1/auth/me', { preHandler: requireAuth }, async (req, reply) => {
    const authReq = req as FastifyRequest & { userId: string };
    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid profile update' }
      });
    }

    const db = getDb();
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(parsed.data.displayName, authReq.userId);
    const user = getUserById(db, authReq.userId);
    if (!user) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    return reply.send({
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatarColor: user.avatar_color,
        createdAt: user.created_at,
      }
    });
  });
}
