import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getDb } from '../db/index.js';
import { requireAuth } from '../auth/routes.js';
import { canReadChannel } from '../auth/permissions.js';
import { ReadCursorSchema } from '@sideband/contracts';

type AuthReq = FastifyRequest & { userId: string };

export async function registerReadCursorRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/channels/:id/read
  app.post('/api/v1/channels/:id/read', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id: channelId } = req.params as { id: string };
    const db = getDb();

    if (!canReadChannel(db, channelId, userId)) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const channel = db.prepare('SELECT last_sequence FROM channels WHERE id = ?').get(channelId) as
      | { last_sequence: number }
      | undefined;
    if (!channel) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Channel not found' } });
    }

    const parsed = ReadCursorSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid sequence' }
      });
    }

    // Clamp to channel's current last_sequence
    const clampedSeq = Math.min(parsed.data.lastReadSequence, channel.last_sequence);

    db.prepare(`
      INSERT INTO read_cursors (user_id, channel_id, last_read_sequence, updated_at)
      VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      ON CONFLICT(user_id, channel_id) DO UPDATE SET
        last_read_sequence = excluded.last_read_sequence,
        updated_at = excluded.updated_at
    `).run(userId, channelId, clampedSeq);

    return reply.send({
      data: {
        channelId,
        lastReadSequence: clampedSeq,
      }
    });
  });
}
