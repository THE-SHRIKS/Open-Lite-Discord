import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getDb } from '../db/index.js';
import { requireAuth } from '../auth/routes.js';
import { hasSpacePermission, canReadChannel } from '../auth/permissions.js';
import { UpdateMessageSchema } from '@sideband/contracts';
import { emitToChannel } from '../realtime/index.js';

type AuthReq = FastifyRequest & { userId: string };

interface MessageRow {
  id: string;
  channel_id: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_color: string;
  body: string | null;
  sequence: number;
  client_nonce: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

interface AttachmentItem {
  id: string;
  originalFilename: string;
  mime: string;
  byteLength: number;
}

const MESSAGE_SELECT = `
  SELECT
    m.id, m.channel_id, m.author_id,
    u.username AS author_username,
    u.display_name AS author_display_name,
    u.avatar_color AS author_avatar_color,
    m.body, m.sequence, m.client_nonce, m.edited_at, m.deleted_at, m.created_at
  FROM messages m
  JOIN users u ON u.id = m.author_id
`;

function loadAttachmentsForMessage(db: any, messageId: string): AttachmentItem[] {
  const rows = db.prepare(`
    SELECT id, original_filename, mime, byte_length
    FROM attachments
    WHERE message_id = ?
  `).all(messageId) as {
    id: string;
    original_filename: string;
    mime: string;
    byte_length: number;
  }[];

  return rows.map(r => ({
    id: r.id,
    originalFilename: r.original_filename,
    mime: r.mime,
    byteLength: r.byte_length,
  }));
}

function rowToDTO(row: MessageRow, attachments: AttachmentItem[] = []) {
  return {
    id: row.id,
    channelId: row.channel_id,
    authorId: row.author_id,
    authorUsername: row.author_username,
    authorDisplayName: row.author_display_name,
    authorAvatarColor: row.author_avatar_color,
    body: row.body,
    sequence: row.sequence,
    clientNonce: row.client_nonce,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    attachments,
  };
}

export async function registerMessageMutationRoutes(app: FastifyInstance): Promise<void> {
  // PATCH /api/v1/messages/:id — edit message body
  app.patch('/api/v1/messages/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id } = req.params as { id: string };
    const db = getDb();

    const message = db.prepare(`
      SELECT m.id, m.author_id, m.deleted_at, c.space_id, m.channel_id
      FROM messages m JOIN channels c ON c.id = m.channel_id
      WHERE m.id = ?
    `).get(id) as { id: string; author_id: string; deleted_at: string | null; space_id: string; channel_id: string } | undefined;

    if (!message) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Message not found' } });
    if (message.deleted_at) return reply.status(410).send({ error: { code: 'GONE', message: 'Message was deleted' } });

    // Ensure user has access to channel
    if (!canReadChannel(db, message.channel_id, userId)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const isAuthor = message.author_id === userId;
    const canModerate = hasSpacePermission(db, message.space_id, userId, 'message:moderate');

    if (!isAuthor && !canModerate) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    if (isAuthor && !canModerate) {
      if (!hasSpacePermission(db, message.space_id, userId, 'message:edit_own')) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      }
    }

    const parsed = UpdateMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' }
      });
    }

    db.prepare(`
      UPDATE messages SET body = ?, edited_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?
    `).run(parsed.data.body, id);

    const updated = db.prepare(`${MESSAGE_SELECT} WHERE m.id = ?`).get(id) as MessageRow;
    const attachments = loadAttachmentsForMessage(db, id);
    const dto = rowToDTO(updated, attachments);

    emitToChannel(message.channel_id, 'message:updated', { channelId: message.channel_id, message: dto });

    return reply.send({ data: dto });
  });

  // DELETE /api/v1/messages/:id — soft delete
  app.delete('/api/v1/messages/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id } = req.params as { id: string };
    const db = getDb();

    const message = db.prepare(`
      SELECT m.id, m.author_id, m.deleted_at, m.sequence, c.space_id, m.channel_id
      FROM messages m JOIN channels c ON c.id = m.channel_id
      WHERE m.id = ?
    `).get(id) as
      | { id: string; author_id: string; deleted_at: string | null; sequence: number; space_id: string; channel_id: string }
      | undefined;

    if (!message) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Message not found' } });
    if (message.deleted_at) return reply.status(410).send({ error: { code: 'GONE', message: 'Already deleted' } });

    // Ensure user has access to channel
    if (!canReadChannel(db, message.channel_id, userId)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const isAuthor = message.author_id === userId;
    const canModerate = hasSpacePermission(db, message.space_id, userId, 'message:moderate');

    if (!isAuthor && !canModerate) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    if (isAuthor && !canModerate) {
      if (!hasSpacePermission(db, message.space_id, userId, 'message:delete_own')) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      }
    }

    db.prepare(`
      UPDATE messages SET body = NULL, deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?
    `).run(id);

    emitToChannel(message.channel_id, 'message:deleted', {
      channelId: message.channel_id,
      messageId: id,
      sequence: message.sequence,
    });

    return reply.send({ data: { ok: true } });
  });
}
