import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MessageDTO, ChannelDTO, MemberDTO, SpaceDTO } from '@sideband/contracts';
import { getSocket } from './useConnectionState';
import api from '../../hooks/useApi';

export interface UseRealtimeMessagesOptions {
  channelId?: string;
  spaceId?: string;
}

export function useRealtimeSpace(spaceId?: string, activeChannelId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!spaceId) return;

    const socket = getSocket();

    const subscribeToSpace = () => {
      socket.emit('space:subscribe', spaceId);
    };

    subscribeToSpace();

    const handleChannelCreated = (payload: { spaceId: string; channel: ChannelDTO }) => {
      if (payload.spaceId !== spaceId) return;
      queryClient.invalidateQueries({ queryKey: ['channels', spaceId] });
    };

    const handleChannelUpdated = (payload: { spaceId: string; channel: ChannelDTO }) => {
      if (payload.spaceId !== spaceId) return;
      queryClient.invalidateQueries({ queryKey: ['channels', spaceId] });
    };

    const handleSpaceUpdated = (payload: { spaceId: string; space: SpaceDTO }) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      if (payload.spaceId === spaceId) {
        queryClient.invalidateQueries({ queryKey: ['spaces', spaceId] });
      }
    };

    const handleSpaceDeleted = () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    };

    const handleMembershipUpdated = (payload: { spaceId: string; member: MemberDTO }) => {
      if (payload.spaceId !== spaceId) return;
      queryClient.setQueryData<MemberDTO[]>(['members', spaceId], (members = []) => {
        const idx = members.findIndex((m) => m.userId === payload.member.userId);
        if (idx >= 0) {
          const next = [...members];
          next[idx] = payload.member;
          return next;
        }
        return [...members, payload.member];
      });
      queryClient.invalidateQueries({ queryKey: ['spaces', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['channels', spaceId] });
    };

    const handlePresenceChanged = (payload: { spaceId: string; userId: string; isOnline: boolean }) => {
      if (payload.spaceId !== spaceId) return;
      queryClient.setQueryData<MemberDTO[]>(['members', spaceId], (members = []) => {
        return members.map((m) =>
          m.userId === payload.userId ? { ...m, isOnline: payload.isOnline } : m
        );
      });
    };

    const handleMessageCreatedSpace = (payload: { channelId: string; message: MessageDTO }) => {
      if (payload.channelId !== activeChannelId) {
        queryClient.invalidateQueries({ queryKey: ['channels', spaceId] });
      }
    };

    const handleConnect = () => {
      subscribeToSpace();
      queryClient.invalidateQueries({ queryKey: ['channels', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['members', spaceId] });
    };

    socket.on('channel:created', handleChannelCreated);
    socket.on('channel:updated', handleChannelUpdated);
    socket.on('space:updated', handleSpaceUpdated);
    socket.on('space:deleted', handleSpaceDeleted);
    socket.on('membership:updated', handleMembershipUpdated);
    socket.on('presence:changed', handlePresenceChanged);
    socket.on('message:created', handleMessageCreatedSpace);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('channel:created', handleChannelCreated);
      socket.off('channel:updated', handleChannelUpdated);
      socket.off('space:updated', handleSpaceUpdated);
      socket.off('space:deleted', handleSpaceDeleted);
      socket.off('membership:updated', handleMembershipUpdated);
      socket.off('presence:changed', handlePresenceChanged);
      socket.off('message:created', handleMessageCreatedSpace);
      socket.off('connect', handleConnect);
    };
  }, [spaceId, activeChannelId, queryClient]);
}

export function useRealtimeMessages({ channelId, spaceId }: UseRealtimeMessagesOptions) {
  const queryClient = useQueryClient();
  const [accessRevokedReason, setAccessRevokedReason] = useState<string | null>(null);
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    if (!channelId) return;

    setAccessRevokedReason(null);
    const socket = getSocket();

    // 1. Subscribe to channel
    const subscribeToChannel = () => {
      socket.emit('channel:subscribe', channelId, (err: string | null) => {
        if (err) {
          console.warn(`Failed to subscribe to channel ${channelId}:`, err);
        }
      });
    };

    subscribeToChannel();

    // 2. Realtime event listeners
    const handleMessageCreated = (payload: { channelId: string; message: MessageDTO }) => {
      if (payload.channelId !== channelId) return;
      const { message } = payload;

      queryClient.setQueryData<MessageDTO[]>(['messages', channelId], (old = []) => {
        const existsIndex = old.findIndex(
          (m) =>
            m.id === message.id ||
            (Boolean(message.clientNonce) && m.clientNonce === message.clientNonce)
        );

        if (existsIndex >= 0) {
          const next = [...old];
          next[existsIndex] = message;
          return next;
        }

        const next = [...old, message];
        next.sort((a, b) => a.sequence - b.sequence);
        return next;
      });

      // Update channel lastSequence if in the same space
      if (spaceId) {
        queryClient.setQueryData<ChannelDTO[]>(['channels', spaceId], (channels = []) => {
          return channels.map((c) =>
            c.id === channelId
              ? { ...c, lastSequence: Math.max(c.lastSequence, message.sequence) }
              : c
          );
        });
      }
    };

    const handleMessageUpdated = (payload: { channelId: string; message: MessageDTO }) => {
      if (payload.channelId !== channelId) return;
      const { message } = payload;

      queryClient.setQueryData<MessageDTO[]>(['messages', channelId], (old = []) => {
        if (!old) return old;
        return old.map((m) => (m.id === message.id ? message : m));
      });
    };

    const handleMessageDeleted = (payload: { channelId: string; messageId: string; sequence: number }) => {
      if (payload.channelId !== channelId) return;
      const { messageId } = payload;

      queryClient.setQueryData<MessageDTO[]>(['messages', channelId], (old = []) => {
        if (!old) return old;
        return old.map((m) =>
          m.id === messageId
            ? { ...m, body: null, deletedAt: new Date().toISOString() }
            : m
        );
      });
    };

    const handleAccessRevoked = (payload: { channelId: string; reason: string }) => {
      if (payload.channelId === channelId) {
        setAccessRevokedReason(payload.reason || 'Access to this channel was revoked');
        if (spaceId) {
          queryClient.invalidateQueries({ queryKey: ['channels', spaceId] });
        }
      }
    };

    // Reconnection handling: re-subscribe and fetch missed messages
    const handleConnect = async () => {
      if (wasConnectedRef.current) {
        subscribeToChannel();

        // Calculate highest sequence currently in cache
        const currentMessages = queryClient.getQueryData<MessageDTO[]>(['messages', channelId]) ?? [];
        const highestSequence = currentMessages.reduce((max, m) => Math.max(max, m.sequence), 0);

        try {
          const url =
            highestSequence > 0
              ? `/api/v1/channels/${channelId}/messages?after=${highestSequence}`
              : `/api/v1/channels/${channelId}/messages?limit=50`;

          const missed = await api.get<MessageDTO[]>(url);
          if (Array.isArray(missed) && missed.length > 0) {
            queryClient.setQueryData<MessageDTO[]>(['messages', channelId], (old = []) => {
              const map = new Map<string, MessageDTO>();
              for (const m of old) map.set(m.id, m);
              for (const m of missed) map.set(m.id, m);
              const merged = Array.from(map.values());
              merged.sort((a, b) => a.sequence - b.sequence);
              return merged;
            });
          }
        } catch (e) {
          console.warn('Failed to fetch missed messages on reconnect:', e);
        }
      }
      wasConnectedRef.current = true;
    };

    const handleDisconnect = () => {
      wasConnectedRef.current = true;
    };

    socket.on('message:created', handleMessageCreated);
    socket.on('message:updated', handleMessageUpdated);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('access:revoked', handleAccessRevoked);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.emit('channel:unsubscribe', channelId);
      socket.off('message:created', handleMessageCreated);
      socket.off('message:updated', handleMessageUpdated);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('access:revoked', handleAccessRevoked);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [channelId, spaceId, queryClient]);

  return {
    accessRevokedReason,
  };
}

export default useRealtimeMessages;
