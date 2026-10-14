import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type Database from 'better-sqlite3';
import { PresenceTracker } from './presence.js';
import { validateSession, getUserById } from '../auth/service.js';
import { canReadChannel, getSpaceRole } from '../auth/permissions.js';
import { isAllowedOrigin } from '../auth/origin.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@sideband/contracts/events';

export const presenceTracker = new PresenceTracker();

let _io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> | null = null;

export function getIo(): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  if (!_io) {
    throw new Error('Socket.IO is not initialized');
  }
  return _io;
}

export function emitToChannel<K extends keyof ServerToClientEvents>(
  channelId: string,
  event: K,
  payload: Parameters<ServerToClientEvents[K]>[0]
): void {
  try {
    const io = getIo();
    (io.to(`channel:${channelId}`).emit as any)(event, payload);
  } catch {
    // Socket.IO may not be initialized in some tests
  }
}

export function joinUserSocketsToSpace(userId: string, spaceId: string): void {
  try {
    const io = getIo();
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data?.userId === userId) {
        socket.join(`space:${spaceId}`);
        const currentSpaces = Array.from(socket.rooms)
          .filter(r => r.startsWith('space:'))
          .map(r => r.slice('space:'.length));
        presenceTracker.track(socket.id, userId, currentSpaces);
      }
    }
    if (presenceTracker.isOnline(userId)) {
      io.to(`space:${spaceId}`).emit('presence:changed', {
        spaceId,
        userId,
        isOnline: true,
      });
    }
  } catch {
    // Socket.IO may not be initialized
  }
}

function parseCookie(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [name, ...val] = part.trim().split('=');
    if (name) {
      result[name] = decodeURIComponent(val.join('='));
    }
  }
  return result;
}

export function initSocketIO(
  httpServer: HttpServer,
  db: Database.Database
): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    path: '/socket.io',
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error('FORBIDDEN_ORIGIN'));
        }
      },
      credentials: true,
    },
  });

  // Handshake authentication middleware
  io.use((socket, next) => {
    const origin = socket.handshake.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      return next(new Error('FORBIDDEN_ORIGIN'));
    }

    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookie(cookieHeader);
    const token = cookies['sideband_session'];

    if (!token) {
      return next(new Error('UNAUTHORIZED'));
    }

    const session = validateSession(db, token);
    if (!session) {
      return next(new Error('UNAUTHORIZED'));
    }

    const user = getUserById(db, session.userId);
    if (!user) {
      return next(new Error('UNAUTHORIZED'));
    }

    socket.data = {
      userId: user.id,
      username: user.username,
      sessionId: session.sessionId,
    };

    next();
  });

  io.on('connection', (socket) => {
    const { userId, username } = socket.data;

    // Get user's spaces
    const spaceRows = db.prepare(`
      SELECT space_id FROM space_members WHERE user_id = ?
    `).all(userId) as { space_id: string }[];
    const spaceIds = spaceRows.map(r => r.space_id);

    // Join space rooms
    for (const spaceId of spaceIds) {
      socket.join(`space:${spaceId}`);
    }

    // Track presence
    presenceTracker.track(socket.id, userId, spaceIds);
    for (const spaceId of spaceIds) {
      io.to(`space:${spaceId}`).emit('presence:changed', {
        spaceId,
        userId,
        isOnline: true,
      });
    }

    // Allow subscribing to newly joined spaces
    socket.on('space:subscribe', (spaceId: string, ack?: (err: string | null) => void) => {
      if (typeof spaceId !== 'string' || !spaceId) {
        ack?.('VALIDATION_ERROR');
        return;
      }
      const role = getSpaceRole(db, spaceId, userId);
      if (!role) {
        ack?.('FORBIDDEN');
        return;
      }
      socket.join(`space:${spaceId}`);
      const currentSpaces = Array.from(socket.rooms)
        .filter(r => r.startsWith('space:'))
        .map(r => r.slice('space:'.length));
      presenceTracker.track(socket.id, userId, currentSpaces);
      io.to(`space:${spaceId}`).emit('presence:changed', {
        spaceId,
        userId,
        isOnline: true,
      });
      ack?.(null);
    });

    // Handle channel:subscribe
    socket.on('channel:subscribe', (channelId: string, ack: (err: string | null) => void) => {
      if (typeof channelId !== 'string' || !canReadChannel(db, channelId, userId)) {
        if (typeof ack === 'function') ack('FORBIDDEN');
        socket.emit('error', { code: 'FORBIDDEN', message: 'Cannot subscribe to channel' });
        return;
      }

      socket.join(`channel:${channelId}`);
      if (typeof ack === 'function') ack(null);
    });

    // Handle channel:unsubscribe
    socket.on('channel:unsubscribe', (channelId: string) => {
      if (typeof channelId === 'string') {
        socket.leave(`channel:${channelId}`);
      }
    });

    // Typing state rate limiting (max 10 events per 5 seconds)
    const typingTimestamps: number[] = [];
    socket.on('typing:set', (payload) => {
      if (!payload || typeof payload.channelId !== 'string' || typeof payload.isTyping !== 'boolean') {
        return;
      }
      const { channelId, isTyping } = payload;
      const now = Date.now();
      while (typingTimestamps.length > 0 && typingTimestamps[0]! < now - 5000) {
        typingTimestamps.shift();
      }
      if (typingTimestamps.length >= 10) {
        return; // drop silently on rate limit
      }
      typingTimestamps.push(now);

      if (!canReadChannel(db, channelId, userId)) {
        return;
      }

      const user = getUserById(db, userId);
      const displayName = user?.display_name ?? username;

      socket.to(`channel:${channelId}`).emit('typing:changed', {
        channelId,
        userId,
        displayName,
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      const entry = presenceTracker.untrack(socket.id);
      if (entry && !presenceTracker.isOnline(userId)) {
        for (const spaceId of entry.spaceIds) {
          io.to(`space:${spaceId}`).emit('presence:changed', {
            spaceId,
            userId,
            isOnline: false,
          });
        }
      }
    });
  });

  _io = io;
  return io;
}
