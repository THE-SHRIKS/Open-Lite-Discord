import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { requireAuth } from '../auth/routes.js';
import {
  assertSpacePermission,
  canReadChannel,
  getSpaceRole,
  auditLog,
} from '../auth/permissions.js';
import { CreateChannelSchema, UpdateChannelSchema } from '@sideband/contracts';
import { getIo } from '../realtime/index.js';
import { rejectUnauthorizedRooms } from '../realtime/authorization.js';

type AuthReq = FastifyRequest & { userId: string };

interface ChannelRow {
  id: string;
  space_id: string;
  name: string;
  topic: string | null;
  visibility: 'public' | 'private';
  channel_order: number;
  last_sequence: number;
  archived_at: string | null;
  last_read_sequence?: number;
  unread_count?: number;
}

function toDTO(c: ChannelRow) {
  const lastRead = c.last_read_sequence ?? 0;
  const unreadCount = c.unread_count ?? Math.max(0, c.last_sequence - lastRead);
  return {
    id: c.id,
    spaceId: c.space_id,
    name: c.name,
    topic: c.topic,
    visibility: c.visibility,
    channelOrder: c.channel_order,
    lastSequence: c.last_sequence,
    archivedAt: c.archived_at,
    unreadCount,
  };
}

export async function registerChannelRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/spaces/:spaceId/channels
  app.get('/api/v1/spaces/:spaceId/channels', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { spaceId } = req.params as { spaceId: string };
    const db = getDb();

    const role = getSpaceRole(db, spaceId, userId);
    if (!role) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Not a member of this space' } });
    }

    let channels: ChannelRow[];
    if (role === 'owner' || role === 'admin') {
      channels = db.prepare(`
        SELECT c.id, c.space_id, c.name, c.topic, c.visibility, c.channel_order, c.last_sequence, c.archived_at,
               COALESCE(rc.last_read_sequence, 0) as last_read_sequence
        FROM channels c
        LEFT JOIN read_cursors rc ON rc.channel_id = c.id AND rc.user_id = ?
        WHERE c.space_id = ?
        ORDER BY c.channel_order ASC, c.created_at ASC
      `).all(userId, spaceId) as ChannelRow[];
    } else {
      channels = db.prepare(`
        SELECT DISTINCT c.id, c.space_id, c.name, c.topic, c.visibility,
               c.channel_order, c.last_sequence, c.archived_at,
               COALESCE(rc.last_read_sequence, 0) as last_read_sequence
        FROM channels c
        LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?
        LEFT JOIN read_cursors rc ON rc.channel_id = c.id AND rc.user_id = ?
        WHERE c.space_id = ?
          AND (c.visibility = 'public' OR cm.user_id IS NOT NULL)
        ORDER BY c.channel_order ASC, c.created_at ASC
      `).all(userId, userId, spaceId) as ChannelRow[];
    }

    return reply.send({ data: channels.map(toDTO) });
  });

  // POST /api/v1/spaces/:spaceId/channels
  app.post('/api/v1/spaces/:spaceId/channels', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { spaceId } = req.params as { spaceId: string };
    const db = getDb();

    try {
      assertSpacePermission(db, spaceId, userId, 'channel:create');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const parsed = CreateChannelSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' }
      });
    }

    const { name, topic, visibility } = parsed.data;

    // Determine channel_order
    const maxOrder = db.prepare('SELECT COALESCE(MAX(channel_order),0) as m FROM channels WHERE space_id = ?').get(spaceId) as { m: number };

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO channels (id, space_id, name, topic, visibility, channel_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, spaceId, name, topic ?? null, visibility, maxOrder.m + 1);

    // If private, add creator as channel member
    if (visibility === 'private') {
      db.prepare('INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(id, userId);
    }

    auditLog(db, 'channel:created', userId, spaceId, id, { name, visibility });

    const channel = db.prepare(`
      SELECT id, space_id, name, topic, visibility, channel_order, last_sequence, archived_at
      FROM channels WHERE id = ?
    `).get(id) as ChannelRow;

    const dto = toDTO(channel);
    try {
      getIo().to(`space:${spaceId}`).emit('channel:created', { spaceId, channel: dto });
    } catch {
      // IO may not be active
    }

    return reply.status(201).send({ data: dto });
  });

  // PATCH /api/v1/channels/:id
  app.patch('/api/v1/channels/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id } = req.params as { id: string };
    const db = getDb();

    const channel = db.prepare('SELECT space_id FROM channels WHERE id = ?').get(id) as { space_id: string } | undefined;
    if (!channel) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found' } });

    try {
      assertSpacePermission(db, channel.space_id, userId, 'channel:edit');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const parsed = UpdateChannelSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' }
      });
    }

    const { name, topic } = parsed.data;
    if (name !== undefined) db.prepare('UPDATE channels SET name = ? WHERE id = ?').run(name, id);
    if (topic !== undefined) db.prepare('UPDATE channels SET topic = ? WHERE id = ?').run(topic, id);

    auditLog(db, 'channel:edited', userId, channel.space_id, id);

    const updated = db.prepare(`
      SELECT id, space_id, name, topic, visibility, channel_order, last_sequence, archived_at
      FROM channels WHERE id = ?
    `).get(id) as ChannelRow;

    const dto = toDTO(updated);
    try {
      getIo().to(`space:${channel.space_id}`).emit('channel:updated', { spaceId: channel.space_id, channel: dto });
    } catch {
      // ignore
    }

    return reply.send({ data: dto });
  });

  // DELETE /api/v1/channels/:id — archive
  app.delete('/api/v1/channels/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id } = req.params as { id: string };
    const db = getDb();

    const channel = db.prepare('SELECT space_id, archived_at FROM channels WHERE id = ?').get(id) as
      | { space_id: string; archived_at: string | null }
      | undefined;
    if (!channel) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found' } });

    try {
      assertSpacePermission(db, channel.space_id, userId, 'channel:archive');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    db.prepare(`UPDATE channels SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(id);
    auditLog(db, 'channel:archived', userId, channel.space_id, id);

    const updated = db.prepare(`
      SELECT id, space_id, name, topic, visibility, channel_order, last_sequence, archived_at
      FROM channels WHERE id = ?
    `).get(id) as ChannelRow;

    const dto = toDTO(updated);
    try {
      getIo().to(`space:${channel.space_id}`).emit('channel:updated', { spaceId: channel.space_id, channel: dto });
    } catch {
      // ignore
    }

    return reply.send({ data: { ok: true } });
  });

  // GET /api/v1/channels/:id/members — list userIds granted access to private channel
  app.get('/api/v1/channels/:id/members', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id: channelId } = req.params as { id: string };
    const db = getDb();

    if (!canReadChannel(db, channelId, userId)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const members = db.prepare('SELECT user_id FROM channel_members WHERE channel_id = ?').all(channelId) as {
      user_id: string;
    }[];

    return reply.send({ data: members.map(m => m.user_id) });
  });

  // POST /api/v1/channels/:id/members — grant private channel access
  app.post('/api/v1/channels/:id/members', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id: channelId } = req.params as { id: string };
    const db = getDb();

    const channel = db.prepare('SELECT space_id FROM channels WHERE id = ?').get(channelId) as { space_id: string } | undefined;
    if (!channel) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found' } });

    try {
      assertSpacePermission(db, channel.space_id, userId, 'channel:edit');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const bodyParsed = z.object({ userId: z.string() }).safeParse(req.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'userId is required' } });
    }
    const targetUserId = bodyParsed.data.userId;

    // Verify target user is in the space
    const targetRole = getSpaceRole(db, channel.space_id, targetUserId);
    if (!targetRole) {
      return reply.status(400).send({ error: { code: 'USER_NOT_IN_SPACE', message: 'Target user is not a member of the space' } });
    }

    db.prepare(`
      INSERT INTO channel_members (channel_id, user_id)
      VALUES (?, ?)
      ON CONFLICT DO NOTHING
    `).run(channelId, targetUserId);

    auditLog(db, 'channel:member_added', userId, channel.space_id, channelId, { targetUserId });

    const chRow = db.prepare(`
      SELECT id, space_id, name, topic, visibility, channel_order, last_sequence, archived_at
      FROM channels WHERE id = ?
    `).get(channelId) as ChannelRow | undefined;
    if (chRow) {
      try {
        getIo().to(`space:${channel.space_id}`).emit('channel:updated', {
          spaceId: channel.space_id,
          channel: toDTO(chRow),
        });
      } catch {
        // ignore
      }
    }

    return reply.status(201).send({ data: { channelId, userId: targetUserId } });
  });

  // DELETE /api/v1/channels/:id/members/:userId — revoke private channel access
  app.delete('/api/v1/channels/:id/members/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { userId: actorId } = req as AuthReq;
    const { id: channelId, userId: targetUserId } = req.params as { id: string; userId: string };
    const db = getDb();

    const channel = db.prepare('SELECT space_id FROM channels WHERE id = ?').get(channelId) as { space_id: string } | undefined;
    if (!channel) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found' } });

    try {
      assertSpacePermission(db, channel.space_id, actorId, 'channel:edit');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?').run(channelId, targetUserId);
    auditLog(db, 'channel:member_removed', actorId, channel.space_id, channelId, { targetUserId });

    // Eject user from Socket.IO room immediately
    rejectUnauthorizedRooms(targetUserId);

    const chRow = db.prepare(`
      SELECT id, space_id, name, topic, visibility, channel_order, last_sequence, archived_at
      FROM channels WHERE id = ?
    `).get(channelId) as ChannelRow | undefined;
    if (chRow) {
      try {
        getIo().to(`space:${channel.space_id}`).emit('channel:updated', {
          spaceId: channel.space_id,
          channel: toDTO(chRow),
        });
      } catch {
        // ignore
      }
    }

    return reply.send({ data: { ok: true } });
  });
}
