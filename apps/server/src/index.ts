import fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import type Database from 'better-sqlite3';
import type { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { getDb, closeDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { isAllowedOrigin } from './auth/origin.js';
import { initSocketIO } from './realtime/index.js';

import { registerAuthRoutes } from './auth/routes.js';
import { registerSpaceRoutes } from './domains/spaces.js';
import { registerChannelRoutes } from './domains/channels.js';
import { registerMessageRoutes } from './domains/messages.js';
import { registerMessageMutationRoutes } from './domains/messageMutations.js';
import { registerMemberRoutes } from './domains/members.js';
import { registerInviteRoutes } from './domains/invites.js';
import { registerSearchRoutes } from './domains/search.js';
import { registerAttachmentRoutes } from './domains/attachments.js';
import { registerReadCursorRoutes } from './domains/readCursors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface BuildAppOptions {
  dataDir?: string;
  logger?: boolean;
}

export async function buildApp(options?: BuildAppOptions): Promise<{
  app: FastifyInstance;
  io: SocketIOServer;
  db: Database.Database;
}> {
  // If a custom dataDir is supplied and a previous DB was open, close it first
  if (options?.dataDir) {
    closeDb();
  }
  const db = getDb(options?.dataDir);
  runMigrations(db);

  const app = fastify({
    bodyLimit: 6 * 1024 * 1024,
    logger: options?.logger ?? false,
  });

  // Custom error handler — never leak stack traces or raw SQL
  app.setErrorHandler((error, _req, reply) => {
    const errObj = error as { statusCode?: number; status?: number; code?: string; message?: string };
    const statusCode = errObj.statusCode || errObj.status || 500;
    let code = errObj.code || (statusCode >= 500 ? 'SERVER_ERROR' : 'VALIDATION_ERROR');
    if (statusCode === 413 || code === 'FST_ERR_CTP_BODY_TOO_LARGE' || code === 'FST_REQ_FILE_TOO_LARGE') {
      code = 'PAYLOAD_TOO_LARGE';
    }
    const message = statusCode >= 500 ? 'Internal server error' : (errObj.message || 'Request failed');
    return reply.status(statusCode).send({
      error: {
        code: typeof code === 'string' ? code : 'SERVER_ERROR',
        message,
      },
    });
  });

  // Origin verification hook for mutating methods (CSRF protection)
  app.addHook('preHandler', async (req, reply) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && !isAllowedOrigin(origin)) {
        return reply.status(403).send({
          error: { code: 'FORBIDDEN_ORIGIN', message: 'Untrusted origin' },
        });
      }
    }
  });

  // Plugins
  await app.register(fastifyCookie);

  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      if (isAllowedOrigin(origin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
  });

  await app.register(fastifyMultipart, {
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  });

  // Health checks
  const healthHandler = async () => ({
    data: { status: 'ok', uptime: process.uptime() },
  });
  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  // Register domain routes
  await registerAuthRoutes(app);
  await registerSpaceRoutes(app);
  await registerChannelRoutes(app);
  await registerMessageRoutes(app);
  await registerMessageMutationRoutes(app);
  await registerMemberRoutes(app);
  await registerInviteRoutes(app);
  await registerSearchRoutes(app);
  await registerAttachmentRoutes(app);
  await registerReadCursorRoutes(app);

  // Serve static assets if web/dist exists
  const webDistPath = path.resolve(__dirname, '../../web/dist');
  if (fs.existsSync(webDistPath)) {
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });

    app.setNotFoundHandler((req, reply) => {
      const url = req.raw.url || '';
      if (!url.startsWith('/api') && !url.startsWith('/socket.io')) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      });
    });
  }

  // Socket.IO attachment
  const io = initSocketIO(app.server, db);

  return { app, io, db };
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  buildApp({ logger: true })
    .then(async ({ app }) => {
      await app.listen({ host: config.HOST, port: config.PORT });
      console.log(`[server] SIDEBAND listening on ${config.HOST}:${config.PORT}`);
    })
    .catch((err) => {
      console.error('[server] Startup error:', err);
      process.exit(1);
    });
}
