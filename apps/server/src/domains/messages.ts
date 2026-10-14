import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getDb } from '../db/index.js';
import { requireAuth, checkRateLimit } from '../auth/routes.js';
import { canReadChannel, assertSpacePermission } from '../auth/permissions.js';
import { CreateMessageSchema } from '@sideband/contracts';
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

function loadAttachmentsForMessages(db: any, messageIds: string[]): Map<string, AttachmentItem[]> {
  const map = new Map<string, AttachmentItem[]>();
  if (messageIds.length === 0) return map;

  const placeholders = messageIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT id, message_id, original_filename, mime, byte_length
    FROM attachments
    WHERE message_id IN (${placeholders})
  `).all(...messageIds) as {
    id: string;
    message_id: string;
    original_filename: string;
    mime: string;
    byte_length: number;
  }[];

  for (const r of rows) {
    const list = map.get(r.message_id) ?? [];
    list.push({
      id: r.id,
      originalFilename: r.original_filename,
      mime: r.mime,
      byteLength: r.byte_length,
    });
    map.set(r.message_id, list);
  }

  return map;
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

export async function registerMessageRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/channels/:id/messages
  app.get('/api/v1/channels/:id/messages', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id: channelId } = req.params as { id: string };
    const query = req.query as { before?: string; after?: string; limit?: string };
    const db = getDb();

    if (!canReadChannel(db, channelId, userId)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const limit = Math.min(Math.max(parseInt(query.limit ?? '50', 10) || 50, 1), 100);
    const before = query.before ? parseInt(query.before, 10) : undefined;
    const after = query.after ? parseInt(query.after, 10) : undefined;

    let rows: MessageRow[];
    if (after !== undefined && !isNaN(after)) {
      rows = db.prepare(`
        ${MESSAGE_SELECT}
        WHERE m.channel_id = ? AND m.sequence > ?
        ORDER BY m.sequence ASC LIMIT ?
      `).all(channelId, after, limit) as MessageRow[];
    } else if (before !== undefined && !isNaN(before)) {
      const descRows = db.prepare(`
        ${MESSAGE_SELECT}
        WHERE m.channel_id = ? AND m.sequence < ?
        ORDER BY m.sequence DESC LIMIT ?
      `).all(channelId, before, limit) as MessageRow[];
      rows = descRows.reverse();
    } else {
      const descRows = db.prepare(`
        ${MESSAGE_SELECT}
        WHERE m.channel_id = ?
        ORDER BY m.sequence DESC LIMIT ?
      `).all(channelId, limit) as MessageRow[];
      rows = descRows.reverse();
    }

    const messageIds = rows.map(r => r.id);
    const attachmentsMap = loadAttachmentsForMessages(db, messageIds);

    return reply.send({
      data: rows.map(r => rowToDTO(r, attachmentsMap.get(r.id) ?? []))
    });
  });

  // POST /api/v1/channels/:id/messages
  app.post('/api/v1/channels/:id/messages', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id: channelId } = req.params as { id: string };
    const maxMsgPerMin = Number(process.env.MESSAGE_RATE_LIMIT_MAX || 600);
    if (!checkRateLimit(`msg:${userId}`, maxMsgPerMin, 60_000)) {
      return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many messages sent, please slow down' } });
    }
    const db = getDb();

    if (!canReadChannel(db, channelId, userId)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const channel = db.prepare('SELECT space_id, archived_at FROM channels WHERE id = ?').get(channelId) as
      | { space_id: string; archived_at: string | null }
      | undefined;
    if (!channel) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found' } });

    if (channel.archived_at) {
      return reply.status(403).send({ error: { code: 'CHANNEL_ARCHIVED', message: 'Channel is archived' } });
    }

    try {
      assertSpacePermission(db, channel.space_id, userId, 'message:create');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const parsed = CreateMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' }
      });
    }

    const { body, clientNonce, attachmentIds } = parsed.data;
    const id = crypto.randomUUID();

    let messageId: string;
    try {
      const insertTx = db.transaction(() => {
        // Atomically increment last_sequence and insert
        db.prepare('UPDATE channels SET last_sequence = last_sequence + 1 WHERE id = ?').run(channelId);
        const seq = (db.prepare('SELECT last_sequence FROM channels WHERE id = ?').get(channelId) as { last_sequence: number }).last_sequence;

        db.prepare(`
          INSERT INTO messages (id, channel_id, author_id, body, sequence, client_nonce)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, channelId, userId, body, seq, clientNonce);

        if (attachmentIds && attachmentIds.length > 0) {
          for (const attId of attachmentIds) {
            db.prepare(`
              UPDATE attachments SET message_id = ?, channel_id = ?
              WHERE id = ? AND uploader_id = ?
            `).run(id, channelId, attId, userId);
          }
        }

        // Auto-update read_cursors for sender
        db.prepare(`
          INSERT INTO read_cursors (user_id, channel_id, last_read_sequence, updated_at)
          VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          ON CONFLICT(user_id, channel_id) DO UPDATE SET
            last_read_sequence = excluded.last_read_sequence,
            updated_at = excluded.updated_at
        `).run(userId, channelId, seq);

        return id;
      });
      messageId = insertTx();
    } catch (err: unknown) {
      // UNIQUE(channel_id, author_id, client_nonce) violation — idempotent retry
      const e = err as { code?: string };
      if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err instanceof Error && err.message.includes('UNIQUE constraint failed'))) {
        const existing = db.prepare(`
          ${MESSAGE_SELECT}
          WHERE m.channel_id = ? AND m.author_id = ? AND m.client_nonce = ?
        `).get(channelId, userId, clientNonce) as MessageRow | undefined;
        if (existing) {
          const attMap = loadAttachmentsForMessages(db, [existing.id]);
          return reply.status(200).send({ data: rowToDTO(existing, attMap.get(existing.id) ?? []) });
        }
      }
      throw err;
    }

    const row = db.prepare(`
      ${MESSAGE_SELECT}
      WHERE m.id = ?
    `).get(messageId) as MessageRow;

    const attMap = loadAttachmentsForMessages(db, [messageId]);
    const dto = rowToDTO(row, attMap.get(messageId) ?? []);

    emitToChannel(channelId, 'message:created', { channelId, message: dto });

    return reply.status(201).send({ data: dto });
  });
}
