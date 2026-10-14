import React, { useEffect, useState, useRef } from 'react';
import { getSocket } from './useConnectionState';
import { useCurrentUser } from '../../hooks/useCurrentUser';

let lastTypingEmitTime = 0;
let stopTypingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Emit typing state to the server with debounce.
 */
export function emitTyping(channelId: string, isTyping: boolean) {
  const socket = getSocket();
  const now = Date.now();

  if (isTyping) {
    if (now - lastTypingEmitTime > 2000) {
      lastTypingEmitTime = now;
      socket.emit('typing:set', { channelId, isTyping: true });
    }
    if (stopTypingTimer) clearTimeout(stopTypingTimer);
    stopTypingTimer = setTimeout(() => {
      socket.emit('typing:set', { channelId, isTyping: false });
      stopTypingTimer = null;
    }, 3000);
  } else {
    if (stopTypingTimer) {
      clearTimeout(stopTypingTimer);
      stopTypingTimer = null;
    }
    socket.emit('typing:set', { channelId, isTyping: false });
  }
}

export interface TypingIndicatorProps {
  channelId: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ channelId }) => {
  const { user } = useCurrentUser();
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setTypingUsers(new Map());
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();

    const socket = getSocket();

    const handleTypingChanged = (payload: {
      channelId: string;
      userId: string;
      displayName: string;
      isTyping: boolean;
    }) => {
      if (payload.channelId !== channelId) return;
      if (user && payload.userId === user.id) return; // Don't show self

      if (payload.isTyping) {
        // Clear previous auto-clear timer if any
        const existingTimer = timersRef.current.get(payload.userId);
        if (existingTimer) clearTimeout(existingTimer);

        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.set(payload.userId, payload.displayName);
          return next;
        });

        // Auto-clear after 3.5 seconds
        const timer = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(payload.userId);
            return next;
          });
          timersRef.current.delete(payload.userId);
        }, 3500);

        timersRef.current.set(payload.userId, timer);
      } else {
        const existingTimer = timersRef.current.get(payload.userId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          timersRef.current.delete(payload.userId);
        }

        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(payload.userId);
          return next;
        });
      }
    };

    socket.on('typing:changed', handleTypingChanged);

    return () => {
      socket.off('typing:changed', handleTypingChanged);
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, [channelId, user]);

  const names = Array.from(typingUsers.values());
  if (names.length === 0) {
    return <div style={{ height: '18px' }} aria-hidden="true" />;
  }

  let text = '';
  if (names.length === 1) {
    text = `${names[0]} is typing...`;
  } else if (names.length === 2) {
    text = `${names[0]} and ${names[1]} are typing...`;
  } else {
    text = `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing...`;
  }

  return (
    <div
      style={{
        height: '18px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        color: 'var(--type-faint, #74827E)',
        letterSpacing: '0.01em',
      }}
      role="status"
      aria-live="polite"
    >
      <span
        style={{
          display: 'inline-flex',
          gap: '3px',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: 'var(--signal, #A0BF9F)',
            animation: 'sideband-pulse 1.2s ease-in-out infinite',
          }}
        />
        <span
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: 'var(--signal, #A0BF9F)',
            animation: 'sideband-pulse 1.2s ease-in-out 0.2s infinite',
          }}
        />
        <span
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            backgroundColor: 'var(--signal, #A0BF9F)',
            animation: 'sideband-pulse 1.2s ease-in-out 0.4s infinite',
          }}
        />
      </span>
      <span>{text}</span>
      <style>{`
        @keyframes sideband-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          span {
            animation: none !important;
            opacity: 0.7 !important;
          }
        }
      `}</style>
    </div>
  );
};

export default TypingIndicator;
