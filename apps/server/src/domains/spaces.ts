import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { requireAuth } from '../auth/routes.js';
import { assertSpacePermission, getSpaceRole, auditLog } from '../auth/permissions.js';
import { CreateSpaceSchema } from '@sideband/contracts';
import { getIo, joinUserSocketsToSpace } from '../realtime/index.js';
import { rejectUnauthorizedRooms } from '../realtime/authorization.js';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'space';
}

export async function registerSpaceRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/spaces — list spaces for current user
  app.get('/api/v1/spaces', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as FastifyRequest & { userId: string };
    const db = getDb();
    const spaces = db.prepare(`
      SELECT s.id, s.name, s.slug, s.icon_text, s.owner_id, s.created_at, sm.role
      FROM spaces s
      JOIN space_members sm ON sm.space_id = s.id AND sm.user_id = ?
      ORDER BY s.created_at ASC
    `).all(userId) as { id: string; name: string; slug: string; icon_text: string; owner_id: string; created_at: string; role: string }[];

    return reply.send({
      data: spaces.map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        iconText: s.icon_text,
        ownerId: s.owner_id,
        createdAt: s.created_at,
        role: s.role,
      }))
    });
  });

  // POST /api/v1/spaces — create space
  app.post('/api/v1/spaces', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as FastifyRequest & { userId: string };
    const parsed = CreateSpaceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' }
      });
    }

    const db = getDb();
    const id = crypto.randomUUID();
    const slug = slugify(parsed.data.name);
    const iconText = parsed.data.iconText ?? parsed.data.name.slice(0, 2).toUpperCase();

    const create = db.transaction(() => {
      db.prepare('INSERT INTO spaces (id, name, slug, owner_id, icon_text) VALUES (?,?,?,?,?)').run(
        id,
        parsed.data.name,
        slug,
        userId,
        iconText
      );
      db.prepare('INSERT INTO space_members (space_id, user_id, role) VALUES (?,?,?)').run(id, userId, 'owner');
    });
    create();

    auditLog(db, 'space:created', userId, id, id, { name: parsed.data.name });
    joinUserSocketsToSpace(userId, id);

    const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(id) as {
      id: string;
      name: string;
      slug: string;
      icon_text: string;
      owner_id: string;
      created_at: string;
    };

    return reply.status(201).send({
      data: {
        id: space.id,
        name: space.name,
        slug: space.slug,
        iconText: space.icon_text,
        ownerId: space.owner_id,
        createdAt: space.created_at,
        role: 'owner',
      }
    });
  });

  // GET /api/v1/spaces/:id
  app.get('/api/v1/spaces/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as FastifyRequest & { userId: string };
    const { id } = req.params as { id: string };
    const db = getDb();
    const role = getSpaceRole(db, id, userId);
    if (!role) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(id) as
      | { id: string; name: string; slug: string; icon_text: string; owner_id: string; created_at: string }
      | undefined;
    if (!space) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Space not found' } });
    }

    return reply.send({
      data: {
        id: space.id,
        name: space.name,
        slug: space.slug,
        iconText: space.icon_text,
        ownerId: space.owner_id,
        createdAt: space.created_at,
        role,
      }
    });
  });

  // PATCH /api/v1/spaces/:id
  app.patch('/api/v1/spaces/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as FastifyRequest & { userId: string };
    const { id } = req.params as { id: string };
    const db = getDb();
    try {
      assertSpacePermission(db, id, userId, 'space:edit');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const body = z.object({
      name: z.string().min(1).max(64).optional(),
      iconText: z.string().max(4).optional(),
    }).safeParse(req.body);

    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } });
    }

    if (body.data.name) db.prepare('UPDATE spaces SET name = ? WHERE id = ?').run(body.data.name, id);
    if (body.data.iconText) db.prepare('UPDATE spaces SET icon_text = ? WHERE id = ?').run(body.data.iconText, id);

    const space = db.prepare('SELECT * FROM spaces WHERE id = ?').get(id) as {
      id: string;
      name: string;
      slug: string;
      icon_text: string;
      owner_id: string;
      created_at: string;
    };

    const dto = {
      id: space.id,
      name: space.name,
      slug: space.slug,
      iconText: space.icon_text,
      ownerId: space.owner_id,
      createdAt: space.created_at,
    };

    auditLog(db, 'space:edited', userId, id, id, body.data);
    try {
      getIo().to(`space:${id}`).emit('space:updated', { spaceId: id, space: dto });
    } catch {
      // ignore if io not active
    }

    return reply.send({ data: dto });
  });

  // DELETE /api/v1/spaces/:id
  app.delete('/api/v1/spaces/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as FastifyRequest & { userId: string };
    const { id } = req.params as { id: string };
    const db = getDb();

    const space = db.prepare('SELECT id, name FROM spaces WHERE id = ?').get(id) as { id: string; name: string } | undefined;
    if (!space) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Space not found' } });
    }

    try {
      assertSpacePermission(db, id, userId, 'space:delete');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Only the space owner can delete a space' } });
    }

    const memberIds = (db.prepare('SELECT user_id FROM space_members WHERE space_id = ?').all(id) as { user_id: string }[]).map(r => r.user_id);

    try {
      getIo().to(`space:${id}`).emit('space:deleted', { spaceId: id });
    } catch {
      // ignore
    }

    db.prepare('DELETE FROM spaces WHERE id = ?').run(id);
    auditLog(db, 'space:deleted', userId, null, id, { name: space.name });

    for (const memberId of memberIds) {
      rejectUnauthorizedRooms(memberId);
    }

    return reply.send({ data: { ok: true } });
  });

  // GET /api/v1/spaces/:id/audit
  app.get('/api/v1/spaces/:id/audit', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as FastifyRequest & { userId: string };
    const { id: spaceId } = req.params as { id: string };
    const db = getDb();

    const role = getSpaceRole(db, spaceId, userId);
    if (!role) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const events = db.prepare(`
      SELECT ae.id, ae.space_id, ae.actor_id, u.username as actor_username, ae.action, ae.target_id, ae.metadata_json, ae.created_at
      FROM audit_events ae
      LEFT JOIN users u ON u.id = ae.actor_id
      WHERE ae.space_id = ?
      ORDER BY ae.created_at DESC
      LIMIT 50
    `).all(spaceId) as {
      id: string;
      space_id: string | null;
      actor_id: string | null;
      actor_username: string | null;
      action: string;
      target_id: string | null;
      metadata_json: string | null;
      created_at: string;
    }[];

    return reply.send({
      data: events.map(e => ({
        id: e.id,
        spaceId: e.space_id,
        actorId: e.actor_id,
        actorUsername: e.actor_username,
        action: e.action,
        targetId: e.target_id,
        metadataJson: e.metadata_json,
        createdAt: e.created_at,
      }))
    });
  });
}
