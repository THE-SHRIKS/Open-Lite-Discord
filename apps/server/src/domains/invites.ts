import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHash, randomBytes } from 'crypto';
import { getDb } from '../db/index.js';
import { requireAuth, checkRateLimit } from '../auth/routes.js';
import { assertSpacePermission, hasSpacePermission, auditLog } from '../auth/permissions.js';
import { CreateInviteSchema, RedeemInviteSchema } from '@sideband/contracts';
import { getIo, joinUserSocketsToSpace } from '../realtime/index.js';

type AuthReq = FastifyRequest & { userId: string };

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function registerInviteRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/spaces/:id/invites — create invite
  app.post('/api/v1/spaces/:id/invites', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id: spaceId } = req.params as { id: string };
    const db = getDb();

    try {
      assertSpacePermission(db, spaceId, userId, 'invite:create');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const parsed = CreateInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' }
      });
    }

    const { expiresInHours, maxUses } = parsed.data;
    const token = randomBytes(32).toString('base64url');
    const hash = tokenHash(token);
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO invites (id, space_id, token_sha256, issued_by, expires_at, uses_remaining)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, spaceId, hash, userId, expiresAt, maxUses);

    auditLog(db, 'invite:created', userId, spaceId, id, { maxUses, expiresInHours });

    return reply.status(201).send({
      data: {
        id,
        spaceId,
        token, // plaintext only on create
        expiresAt,
        usesRemaining: maxUses,
        createdAt: new Date().toISOString(),
      },
    });
  });

  // POST /api/v1/invites/redeem
  app.post('/api/v1/invites/redeem', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const maxRedeemPerMin = Number(process.env.INVITE_RATE_LIMIT_MAX || 20);
    if (!checkRateLimit(`invite:${userId}`, maxRedeemPerMin, 60_000)) {
      return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many invite redemption attempts' } });
    }

    const db = getDb();

    const parsed = RedeemInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid token' } });
    }

    const hash = tokenHash(parsed.data.token);

    interface InviteRow {
      id: string;
      space_id: string;
      expires_at: string;
      uses_remaining: number;
      revoked_at: string | null;
    }

    const invite = db.prepare(`
      SELECT id, space_id, expires_at, uses_remaining, revoked_at
      FROM invites WHERE token_sha256 = ?
    `).get(hash) as InviteRow | undefined;

    if (!invite) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Invite not found or invalid' } });
    }
    if (invite.revoked_at) {
      return reply.status(410).send({ error: { code: 'INVITE_REVOKED', message: 'Invite has been revoked' } });
    }
    if (new Date(invite.expires_at) < new Date()) {
      return reply.status(410).send({ error: { code: 'INVITE_EXPIRED', message: 'Invite has expired' } });
    }
    if (invite.uses_remaining <= 0) {
      return reply.status(410).send({ error: { code: 'INVITE_EXHAUSTED', message: 'Invite has no uses remaining' } });
    }

    // Already a member?
    const existing = db.prepare('SELECT 1 FROM space_members WHERE space_id = ? AND user_id = ?').get(invite.space_id, userId);
    if (existing) {
      joinUserSocketsToSpace(userId, invite.space_id);
      const space = db.prepare('SELECT id, name, slug, icon_text, owner_id, created_at FROM spaces WHERE id = ?').get(invite.space_id) as {
        id: string;
        name: string;
        slug: string;
        icon_text: string;
        owner_id: string;
        created_at: string;
      };
      return reply.send({ data: { spaceId: space.id, spaceName: space.name, slug: space.slug, alreadyMember: true } });
    }

    // Atomically decrement uses and add member
    const redeem = db.transaction(() => {
      const result = db.prepare(`
        UPDATE invites SET uses_remaining = uses_remaining - 1
        WHERE id = ? AND uses_remaining > 0
      `).run(invite.id);
      if (result.changes === 0) throw Object.assign(new Error('Invite exhausted'), { code: 'INVITE_EXHAUSTED', status: 410 });
      db.prepare('INSERT INTO space_members (space_id, user_id, role) VALUES (?, ?, ?)').run(invite.space_id, userId, 'member');
    });

    try {
      redeem();
    } catch (err: unknown) {
      const e = err as { code?: string; status?: number; message?: string };
      return reply.status(e.status ?? 500).send({ error: { code: e.code ?? 'SERVER_ERROR', message: e.message ?? 'Failed to redeem invite' } });
    }

    auditLog(db, 'invite:redeemed', userId, invite.space_id, invite.id);
    joinUserSocketsToSpace(userId, invite.space_id);

    // Notify space members
    const memberRow = db.prepare(`
      SELECT sm.user_id, u.username, u.display_name, u.avatar_color, sm.role, sm.joined_at
      FROM space_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.space_id = ? AND sm.user_id = ?
    `).get(invite.space_id, userId) as {
      user_id: string;
      username: string;
      display_name: string;
      avatar_color: string;
      role: string;
      joined_at: string;
    } | undefined;

    if (memberRow) {
      const memberDTO = {
        userId: memberRow.user_id,
        username: memberRow.username,
        displayName: memberRow.display_name,
        avatarColor: memberRow.avatar_color,
        role: memberRow.role as 'owner' | 'admin' | 'member',
        joinedAt: memberRow.joined_at,
        isOnline: true,
      };
      try {
        getIo().to(`space:${invite.space_id}`).emit('membership:updated', { spaceId: invite.space_id, member: memberDTO });
      } catch {
        // ignore
      }
    }

    const space = db.prepare('SELECT id, name, slug, icon_text, owner_id, created_at FROM spaces WHERE id = ?').get(invite.space_id) as {
      id: string;
      name: string;
      slug: string;
      icon_text: string;
      owner_id: string;
      created_at: string;
    };

    return reply.send({
      data: {
        spaceId: space.id,
        spaceName: space.name,
        slug: space.slug,
        iconText: space.icon_text,
        role: 'member',
      },
    });
  });

  // GET /api/v1/spaces/:id/invites — list active invites (admin/owner)
  app.get('/api/v1/spaces/:id/invites', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id: spaceId } = req.params as { id: string };
    const db = getDb();

    try {
      assertSpacePermission(db, spaceId, userId, 'invite:create');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const invites = db.prepare(`
      SELECT id, space_id, expires_at, uses_remaining, created_at
      FROM invites
      WHERE space_id = ? AND revoked_at IS NULL AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
      ORDER BY created_at DESC
    `).all(spaceId) as { id: string; space_id: string; expires_at: string; uses_remaining: number; created_at: string }[];

    return reply.send({
      data: invites.map(i => ({
        id: i.id,
        spaceId: i.space_id,
        token: '[redacted]',
        expiresAt: i.expires_at,
        usesRemaining: i.uses_remaining,
        createdAt: i.created_at,
      })),
    });
  });

  // DELETE /api/v1/invites/:id — revoke invite
  app.delete('/api/v1/invites/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id } = req.params as { id: string };
    const db = getDb();

    const invite = db.prepare('SELECT id, space_id FROM invites WHERE id = ?').get(id) as
      | { id: string; space_id: string }
      | undefined;
    if (!invite) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Invite not found' } });
    }

    const canRevoke = hasSpacePermission(db, invite.space_id, userId, 'invite:revoke') ||
                      hasSpacePermission(db, invite.space_id, userId, 'invite:create');
    if (!canRevoke) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    db.prepare(`UPDATE invites SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(id);
    auditLog(db, 'invite:revoked', userId, invite.space_id, id);

    return reply.send({ data: { ok: true } });
  });
}
