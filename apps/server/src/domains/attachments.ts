import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db/index.js';
import { config } from '../config.js';
import { requireAuth } from '../auth/routes.js';
import { canReadChannel } from '../auth/permissions.js';

type AuthReq = FastifyRequest & { userId: string };

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/pdf',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function sanitizeFilename(filename: string): string {
  let clean = filename.replace(/[\x00-\x1f\x7f]/g, '');
  clean = path.basename(clean.replace(/\\/g, '/'));
  clean = clean.replace(/\.\.+/g, '.');
  clean = clean.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!clean || clean === '.' || clean === '..') {
    clean = 'file.bin';
  }
  return clean.slice(0, 100);
}

export async function registerAttachmentRoutes(app: FastifyInstance): Promise<void> {
  const uploadsDir = path.resolve(config.DATA_DIR, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  async function handleUpload(req: FastifyRequest, reply: FastifyReply) {
    const { userId } = req as AuthReq;
    const db = getDb();

    const params = req.params as { id?: string };
    const query = req.query as { channelId?: string };
    const channelId = params.id || query.channelId;

    if (channelId) {
      if (!canReadChannel(db, channelId, userId)) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      }
    }

    let originalFilename: string = 'file.bin';
    let mime: string = 'application/octet-stream';
    let fileBuffer: Buffer | null = null;

    if (typeof (req as any).isMultipart === 'function' && (req as any).isMultipart()) {
      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' } });
      }
      originalFilename = data.filename;
      mime = data.mimetype;
      const buf = await data.toBuffer();
      if (data.file.truncated || buf.length > MAX_FILE_SIZE) {
        return reply.status(413).send({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'File exceeds 5MB limit' } });
      }
      fileBuffer = buf;
    } else {
      // JSON base64 or raw body fallback
      const body = req.body as { filename?: string; mime?: string; contentBase64?: string; content?: string } | undefined;
      if (body?.contentBase64) {
        originalFilename = body.filename || 'file.bin';
        mime = body.mime || 'application/octet-stream';
        fileBuffer = Buffer.from(body.contentBase64, 'base64');
      } else if (body?.content && typeof body.content === 'string') {
        originalFilename = body.filename || 'note.txt';
        mime = body.mime || 'text/plain';
        fileBuffer = Buffer.from(body.content, 'utf-8');
      } else {
        return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Invalid upload format' } });
      }

      if (fileBuffer.length > MAX_FILE_SIZE) {
        return reply.status(413).send({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'File exceeds 5MB limit' } });
      }
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return reply.status(400).send({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: `MIME type "${mime}" is not allowed` }
      });
    }

    const sanitized = sanitizeFilename(originalFilename);
    const attachmentId = crypto.randomUUID();
    const storageKey = `${attachmentId}-${sanitized}`;

    const safePath = path.resolve(uploadsDir, storageKey);
    if (!safePath.startsWith(uploadsDir)) {
      return reply.status(400).send({ error: { code: 'INVALID_FILENAME', message: 'Path traversal detected' } });
    }

    // Write file to disk
    fs.writeFileSync(safePath, fileBuffer);

    // Save attachment in database
    db.prepare(`
      INSERT INTO attachments (id, channel_id, uploader_id, storage_key, original_filename, mime, byte_length)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      attachmentId,
      channelId ?? null,
      userId,
      storageKey,
      sanitized,
      mime,
      fileBuffer.length
    );

    return reply.status(201).send({
      data: {
        id: attachmentId,
        originalFilename: sanitized,
        mime,
        byteLength: fileBuffer.length,
      }
    });
  }

  // Upload routes
  app.post('/api/v1/uploads', { preHandler: requireAuth }, handleUpload);
  app.post('/api/v1/channels/:id/uploads', { preHandler: requireAuth }, handleUpload);

  // GET /api/v1/uploads — list authorized uploads
  app.get('/api/v1/uploads', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const query = req.query as { channelId?: string };
    const db = getDb();

    if (query.channelId) {
      if (!canReadChannel(db, query.channelId, userId)) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      }
      const rows = db.prepare(`
        SELECT id, original_filename, mime, byte_length, created_at
        FROM attachments
        WHERE channel_id = ?
        ORDER BY created_at DESC LIMIT 50
      `).all(query.channelId) as { id: string; original_filename: string; mime: string; byte_length: number; created_at: string }[];
      return reply.send({
        data: rows.map(r => ({
          id: r.id,
          originalFilename: r.original_filename,
          mime: r.mime,
          byteLength: r.byte_length,
          createdAt: r.created_at,
        }))
      });
    }

    const rows = db.prepare(`
      SELECT id, original_filename, mime, byte_length, created_at
      FROM attachments
      WHERE uploader_id = ?
      ORDER BY created_at DESC LIMIT 50
    `).all(userId) as { id: string; original_filename: string; mime: string; byte_length: number; created_at: string }[];
    return reply.send({
      data: rows.map(r => ({
        id: r.id,
        originalFilename: r.original_filename,
        mime: r.mime,
        byteLength: r.byte_length,
        createdAt: r.created_at,
      }))
    });
  });

  // Download / view attachment
  async function handleGetAttachment(req: FastifyRequest, reply: FastifyReply) {
    const { userId } = req as AuthReq;
    const { id } = req.params as { id: string };
    const db = getDb();

    const attachment = db.prepare(`
      SELECT a.id, a.channel_id, a.uploader_id, m.channel_id as message_channel_id, a.storage_key, a.original_filename, a.mime, a.byte_length
      FROM attachments a
      LEFT JOIN messages m ON m.id = a.message_id
      WHERE a.id = ?
    `).get(id) as {
      id: string;
      channel_id: string | null;
      uploader_id: string | null;
      message_channel_id: string | null;
      storage_key: string;
      original_filename: string;
      mime: string;
      byte_length: number;
    } | undefined;

    if (!attachment) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Attachment not found' } });
    }

    const channelId = attachment.channel_id || attachment.message_channel_id;
    if (channelId) {
      if (!canReadChannel(db, channelId, userId)) {
        return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
      }
    } else if (attachment.uploader_id !== userId) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const safePath = path.resolve(uploadsDir, attachment.storage_key);
    if (!safePath.startsWith(uploadsDir) || !fs.existsSync(safePath)) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'File not found on disk' } });
    }

    const sanitizedHeaderName = attachment.original_filename.replace(/["\r\n]/g, '');
    reply.header('Content-Type', attachment.mime);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Content-Disposition', `inline; filename="${sanitizedHeaderName}"`);

    const stream = fs.createReadStream(safePath);
    return reply.send(stream);
  }

  app.get('/api/v1/attachments/:id', { preHandler: requireAuth }, handleGetAttachment);
  app.get('/api/v1/uploads/:id', { preHandler: requireAuth }, handleGetAttachment);
}
