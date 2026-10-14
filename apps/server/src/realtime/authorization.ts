import { getDb } from '../db/index.js';
import { canReadChannel, getSpaceRole } from '../auth/permissions.js';
import { getIo } from './index.js';

export function rejectUnauthorizedRooms(userId: string): void {
  let io;
  try {
    io = getIo();
  } catch {
    return;
  }
  if (!io) return;

  const db = getDb();
  const sockets = io.sockets.sockets;

  for (const socket of sockets.values()) {
    if (socket.data?.userId !== userId) continue;

    // Check all rooms this socket has joined
    const rooms = Array.from(socket.rooms);
    for (const room of rooms) {
      if (room.startsWith('channel:')) {
        const channelId = room.slice('channel:'.length);
        if (!canReadChannel(db, channelId, userId)) {
          socket.leave(room);
          socket.emit('access:revoked', { channelId, reason: 'Access revoked' });
        }
      } else if (room.startsWith('space:')) {
        const spaceId = room.slice('space:'.length);
        const role = getSpaceRole(db, spaceId, userId);
        if (!role) {
          socket.leave(room);
        }
      }
    }
  }
}
