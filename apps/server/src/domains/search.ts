import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getDb } from '../db/index.js';
import { requireAuth } from '../auth/routes.js';
import { getSpaceRole } from '../auth/permissions.js';

type AuthReq = FastifyRequest & { userId: string };

interface SearchRow {
  message_id: string;
  channel_id: string;
  channel_name: string;
  author_display_name: string;
  body: string | null;
  sequence: number;
  created_at: string;
  highlight?: string;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateLikeHighlight(text: string, query: string): string {
  if (!text || !query) return text || '';
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/search?q=...&spaceId=...
  app.get('/api/v1/search', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const query = req.query as { q?: string; spaceId?: string };

    const q = query.q?.trim();
    const spaceId = query.spaceId;

    if (!q || q.length > 200) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Query "q" must be between 1 and 200 characters' }
      });
    }

    if (!spaceId) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Query parameter "spaceId" is required' }
      });
    }

    const db = getDb();
    const role = getSpaceRole(db, spaceId, userId);
    if (!role) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Access denied: not a member of this space' }
      });
    }

    let rows: SearchRow[] = [];

    // Attempt FTS5 first
    try {
      const sanitizedFts = q
        .split(/\s+/)
        .filter(Boolean)
        .map(term => `"${term.replace(/"/g, '""')}"*`)
        .join(' ');

      if (sanitizedFts) {
        rows = db.prepare(`
          SELECT
            m.id as message_id,
            m.channel_id,
            c.name as channel_name,
            u.display_name as author_display_name,
            m.body,
            m.sequence,
            m.created_at,
            snippet(messages_fts, 0, '<mark>', '</mark>', '...', 16) as highlight
          FROM messages_fts fts
          JOIN messages m ON m.rowid = fts.rowid
          JOIN channels c ON c.id = m.channel_id
          JOIN users u ON u.id = m.author_id
          WHERE messages_fts MATCH ?
            AND c.space_id = ?
            AND m.deleted_at IS NULL
            AND (
              c.visibility = 'public'
              OR ? = 'owner'
              OR ? = 'admin'
              OR EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?)
            )
          ORDER BY m.sequence DESC
          LIMIT 50
        `).all(sanitizedFts, spaceId, role, role, userId) as SearchRow[];
      }
    } catch {
      // FTS5 error or missing; fallback to LIKE
      rows = [];
    }

    // Fallback to LIKE if FTS produced nothing or errored out
    if (rows.length === 0) {
      const escapedLike = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
      rows = db.prepare(`
        SELECT
          m.id as message_id,
          m.channel_id,
          c.name as channel_name,
          u.display_name as author_display_name,
          m.body,
          m.sequence,
          m.created_at
        FROM messages m
        JOIN channels c ON c.id = m.channel_id
        JOIN users u ON u.id = m.author_id
        WHERE c.space_id = ?
          AND m.deleted_at IS NULL
          AND m.body LIKE ? ESCAPE '\\'
          AND (
            c.visibility = 'public'
            OR ? = 'owner'
            OR ? = 'admin'
            OR EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = ?)
          )
        ORDER BY m.sequence DESC
        LIMIT 50
      `).all(spaceId, escapedLike, role, role, userId) as SearchRow[];

      for (const r of rows) {
        if (r.body) {
          r.highlight = generateLikeHighlight(r.body, q);
        }
      }
    }

    return reply.send({
      data: rows.map(r => ({
        messageId: r.message_id,
        channelId: r.channel_id,
        channelName: r.channel_name,
        authorDisplayName: r.author_display_name,
        body: r.body ?? '',
        sequence: r.sequence,
        createdAt: r.created_at,
        highlight: r.highlight,
      }))
    });
  });
}
