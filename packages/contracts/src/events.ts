import type { MessageDTO, ChannelDTO, MemberDTO, SpaceDTO } from './index.js';

// ─── Server → Client Events ───────────────────────────────────────────────────
export interface ServerToClientEvents {
  'message:created': (payload: { channelId: string; message: MessageDTO }) => void;
  'message:updated': (payload: { channelId: string; message: MessageDTO }) => void;
  'message:deleted': (payload: { channelId: string; messageId: string; sequence: number }) => void;
  'channel:updated': (payload: { spaceId: string; channel: ChannelDTO }) => void;
  'channel:created': (payload: { spaceId: string; channel: ChannelDTO }) => void;
  'space:updated': (payload: { spaceId: string; space: SpaceDTO }) => void;
  'space:deleted': (payload: { spaceId: string }) => void;
  'membership:updated': (payload: { spaceId: string; member: MemberDTO }) => void;
  'typing:changed': (payload: { channelId: string; userId: string; displayName: string; isTyping: boolean }) => void;
  'presence:changed': (payload: { spaceId: string; userId: string; isOnline: boolean }) => void;
  'access:revoked': (payload: { channelId: string; reason: string }) => void;
  error: (payload: { code: string; message: string }) => void;
}

// ─── Client → Server Events ───────────────────────────────────────────────────
export interface ClientToServerEvents {
  'space:subscribe': (spaceId: string, ack?: (err: string | null) => void) => void;
  'channel:subscribe': (channelId: string, ack: (err: string | null) => void) => void;
  'channel:unsubscribe': (channelId: string) => void;
  'typing:set': (payload: { channelId: string; isTyping: boolean }) => void;
}

// ─── Inter-Server Events ──────────────────────────────────────────────────────
export interface InterServerEvents {
  ping: () => void;
}

// ─── Socket Data ──────────────────────────────────────────────────────────────
export interface SocketData {
  userId: string;
  username: string;
  sessionId: string;
}
