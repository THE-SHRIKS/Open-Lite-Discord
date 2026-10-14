import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MessageDTO, AttachmentDTO } from '@sideband/contracts';
import api, { ApiException } from '../../hooks/useApi';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useRealtimeMessages } from './useRealtimeMessages';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';

export interface MessageTimelineProps {
  channelId: string;
  spaceId: string;
  userRole?: 'owner' | 'admin' | 'member';
}

/**
 * Parses markdown-style triple backtick code blocks and inline code safely
 * without using dangerouslySetInnerHTML.
 */
function renderFormattedBody(text: string): React.ReactNode {
  if (!text) return null;

  // Split by code blocks: ```code```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Text preceding code block
    if (match.index > lastIndex) {
      elements.push(
        <span key={`text-${lastIndex}`}>
          {renderInlineText(text.slice(lastIndex, match.index))}
        </span>
      );
    }

    const codeContent = match[2];
    elements.push(
      <pre
        key={`codeblock-${match.index}`}
        style={{
          margin: '8px 0',
          padding: '10px 12px',
          backgroundColor: 'var(--surface-raised, #222B2D)',
          border: '1px solid var(--stroke, #303B3E)',
          borderRadius: 'var(--radius-md, 6px)',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          lineHeight: 1.45,
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}
      >
        <code>{codeContent}</code>
      </pre>
    );

    lastIndex = match.index + match[0].length;
  }

  // Trailing text
  if (lastIndex < text.length) {
    elements.push(
      <span key={`text-${lastIndex}`}>
        {renderInlineText(text.slice(lastIndex))}
      </span>
    );
  }

  return elements;
}

/**
 * Handles inline `code` and regular text breaks.
 */
function renderInlineText(text: string): React.ReactNode {
  const inlineCodeRegex = /`([^`]+)`/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineCodeRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(renderPlainTextWithBreaks(text.slice(lastIdx, match.index), lastIdx));
    }

    parts.push(
      <code
        key={`inline-code-${match.index}`}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          backgroundColor: 'var(--surface-raised, #222B2D)',
          border: '1px solid var(--stroke, #303B3E)',
          padding: '1px 5px',
          borderRadius: '3px',
          color: 'var(--signal, #A0BF9F)',
        }}
      >
        {match[1]}
      </code>
    );

    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    parts.push(renderPlainTextWithBreaks(text.slice(lastIdx), lastIdx));
  }

  return parts;
}

function renderPlainTextWithBreaks(text: string, keyPrefix: number): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, idx) => (
    <React.Fragment key={`plain-${keyPrefix}-${idx}`}>
      {idx > 0 && <br />}
      {line}
    </React.Fragment>
  ));
}

function formatClusterTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;
    return `${d.toLocaleDateString()} ${timeStr}`;
  } catch {
    return isoString;
  }
}

function formatGutterTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const MessageTimeline: React.FC<MessageTimelineProps> = ({
  channelId,
  spaceId,
  userRole = 'member',
}) => {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [searchParams] = useSearchParams();
  const highlightTarget = searchParams.get('highlight');

  // Realtime subscription & revocation tracking
  const { accessRevokedReason } = useRealtimeMessages({ channelId, spaceId });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Pagination state
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);

  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Hover state tracking
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  // Initial messages query
  const {
    data: messages = [],
    isLoading,
    isError,
  } = useQuery<MessageDTO[]>({
    queryKey: ['messages', channelId],
    queryFn: () => api.get<MessageDTO[]>(`/api/v1/channels/${channelId}/messages?limit=50`),
    staleTime: 30_000,
  });

  const canModerate = userRole === 'owner' || userRole === 'admin';

  // Read cursor tracking: auto-mark channel read when viewing newest messages
  const lastMarkedSeqRef = useRef<number>(-1);
  useEffect(() => {
    if (messages.length === 0) return;
    const highestSeq = messages[messages.length - 1].sequence;
    if (highestSeq > lastMarkedSeqRef.current) {
      lastMarkedSeqRef.current = highestSeq;
      api
        .post(`/api/v1/channels/${channelId}/read`, { lastReadSequence: highestSeq })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['channels', spaceId] });
        })
        .catch(() => {
          // silently ignore read cursor failure
        });
    }
  }, [messages, channelId, spaceId, queryClient]);

  // Load older messages (cursor pagination)
  const handleLoadOlder = async () => {
    if (messages.length === 0 || isLoadingOlder || !hasMoreOlder) return;

    const firstSeq = messages[0].sequence;
    const container = scrollContainerRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;

    setIsLoadingOlder(true);
    try {
      const older = await api.get<MessageDTO[]>(
        `/api/v1/channels/${channelId}/messages?before=${firstSeq}&limit=50`
      );

      if (!Array.isArray(older) || older.length === 0) {
        setHasMoreOlder(false);
      } else {
        if (older.length < 50) {
          setHasMoreOlder(false);
        }

        queryClient.setQueryData<MessageDTO[]>(['messages', channelId], (current = []) => {
          const map = new Map<string, MessageDTO>();
          for (const m of older) map.set(m.id, m);
          for (const m of current) map.set(m.id, m);
          const merged = Array.from(map.values());
          merged.sort((a, b) => a.sequence - b.sequence);
          return merged;
        });

        // Restore scroll position after prepend
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = prevScrollTop + (container.scrollHeight - prevScrollHeight);
          }
        });
      }
    } catch (e) {
      console.warn('Failed to load older messages:', e);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Scroll listener: handle "New messages" pill
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottomPill(distFromBottom > 120);
  }, []);

  // Autoscroll to bottom on new message if near bottom
  const prevMessagesLength = useRef(messages.length);
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Check if new message was appended
    if (messages.length > prevMessagesLength.current) {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distFromBottom < 160) {
        el.scrollTop = el.scrollHeight;
      }
    } else if (prevMessagesLength.current === 0 && messages.length > 0) {
      // First load scroll to bottom
      el.scrollTop = el.scrollHeight;
    }

    prevMessagesLength.current = messages.length;
  }, [messages]);

  // Jump to highlighted message if specified in query
  useEffect(() => {
    if (!highlightTarget || messages.length === 0) return;
    const el = document.getElementById(`msg-${highlightTarget}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightTarget, messages]);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      setShowScrollBottomPill(false);
    }
  };

  // Message mutations: Edit
  const startEditing = (msg: MessageDTO) => {
    setEditingMessageId(msg.id);
    setEditBody(msg.body || '');
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditBody('');
    setEditError(null);
  };

  const handleSaveEdit = async (msgId: string) => {
    if (!editBody.trim()) return;
    setIsSavingEdit(true);
    setEditError(null);

    try {
      const updated = await api.patch<MessageDTO>(`/api/v1/messages/${msgId}`, {
        body: editBody.trim(),
      });

      queryClient.setQueryData<MessageDTO[]>(['messages', channelId], (old = []) =>
        old.map((m) => (m.id === msgId ? updated : m))
      );

      setEditingMessageId(null);
    } catch (err) {
      if (err instanceof ApiException) {
        setEditError(err.message || 'Failed to edit message');
      } else {
        setEditError('Connection error saving edit');
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Message mutations: Delete
  const handleDeleteMessage = async (msgId: string) => {
    try {
      await api.delete(`/api/v1/messages/${msgId}`);
      queryClient.setQueryData<MessageDTO[]>(['messages', channelId], (old = []) =>
        old.map((m) =>
          m.id === msgId ? { ...m, body: null, deletedAt: new Date().toISOString() } : m
        )
      );
    } catch (err) {
      console.warn('Failed to delete message:', err);
    }
  };

  if (accessRevokedReason) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '32px',
          textAlign: 'center',
          backgroundColor: 'var(--canvas, #0B0D0E)',
        }}
      >
        <div style={{ color: 'var(--danger, #CE807C)', fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>
          Access Revoked
        </div>
        <p style={{ color: 'var(--type-muted, #9FAAA6)', fontSize: '13px', maxWidth: '360px' }}>
          {accessRevokedReason}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spinner size={28} />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ color: 'var(--danger, #CE807C)', fontSize: '14px', marginBottom: '8px' }}>
          Failed to load message history
        </div>
        <Button size="sm" variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ['messages', channelId] })}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--canvas, #0B0D0E)',
      }}
    >
      {/* Scrollable messages container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Load older messages button */}
        {hasMoreOlder && messages.length >= 50 && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 16px' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadOlder}
              isLoading={isLoadingOlder}
              style={{
                fontSize: '12px',
                color: 'var(--type-muted, #9FAAA6)',
                border: '1px solid var(--stroke, #303B3E)',
              }}
            >
              Load older messages
            </Button>
          </div>
        )}

        {messages.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              textAlign: 'center',
              padding: '40px 16px',
              maxWidth: '360px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '24px',
                color: 'var(--type-faint, #74827E)',
                marginBottom: '12px',
              }}
            >
              #
            </div>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--type, #E9ECE7)', marginBottom: '6px' }}>
              Welcome to the beginning of the channel
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--type-muted, #9FAAA6)' }}>
              This channel was created locally. Send a message to start discussion.
            </p>
          </div>
        ) : (
          messages.map((message, idx) => {
            const prevMessage = idx > 0 ? messages[idx - 1] : null;

            // Clustering logic: same author within 5 minutes (300,000ms)
            const isFirstInCluster =
              !prevMessage ||
              prevMessage.authorId !== message.authorId ||
              Boolean(prevMessage.deletedAt) ||
              new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 300_000;

            const isOwnMessage = user?.id === message.authorId;
            const canManageMessage = isOwnMessage || canModerate;
            const isHovered = hoveredMessageId === message.id;
            const isEditing = editingMessageId === message.id;
            const isHighlighted = highlightTarget === message.id;

            return (
              <div
                key={message.id}
                id={`msg-${message.id}`}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => setHoveredMessageId((cur) => (cur === message.id ? null : cur))}
                style={{
                  position: 'relative',
                  marginTop: isFirstInCluster ? (idx === 0 ? '0' : '14px') : '2px',
                  padding: isFirstInCluster ? '4px 8px 4px 52px' : '2px 8px 2px 52px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  backgroundColor: isHighlighted
                    ? 'rgba(160, 191, 159, 0.08)'
                    : isHovered
                    ? 'var(--surface-2, #1B2224)'
                    : 'transparent',
                  borderLeft: isHighlighted ? '3px solid var(--signal, #A0BF9F)' : '3px solid transparent',
                  transition: 'background-color 100ms ease',
                }}
              >
                {/* Cluster Header (first message in cluster) */}
                {isFirstInCluster && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '8px',
                      marginBottom: '3px',
                    }}
                  >
                    {/* Square avatar badge on left */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '8px',
                        top: '4px',
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-sm, 4px)',
                        backgroundColor: message.authorAvatarColor || 'var(--surface-raised, #222B2D)',
                        color: '#0B0D0E',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        userSelect: 'none',
                        flexShrink: 0,
                      }}
                      title={`${message.authorDisplayName} (@${message.authorUsername})`}
                    >
                      {(message.authorDisplayName || message.authorUsername || 'U').slice(0, 2).toUpperCase()}
                    </div>

                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--type, #E9ECE7)' }}>
                      {message.authorDisplayName}
                    </span>

                    <span style={{ fontSize: '12px', color: 'var(--type-faint, #74827E)' }}>
                      @{message.authorUsername}
                    </span>

                    <span style={{ fontSize: '11px', color: 'var(--type-faint, #74827E)' }}>
                      {formatClusterTimestamp(message.createdAt)}
                    </span>

                    <span
                      style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--type-faint, #74827E)',
                        opacity: 0.6,
                      }}
                      title={`Sequence ${message.sequence}`}
                    >
                      #{message.sequence}
                    </span>
                  </div>
                )}

                {/* Subsequent message in cluster gutter timestamp on hover */}
                {!isFirstInCluster && (
                  <span
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '3px',
                      width: '36px',
                      fontSize: '10px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--type-faint, #74827E)',
                      textAlign: 'right',
                      opacity: isHovered ? 1 : 0,
                      userSelect: 'none',
                    }}
                  >
                    {formatGutterTime(message.createdAt)}
                  </span>
                )}

                {/* Message Body or Editing State */}
                {message.deletedAt ? (
                  <div
                    style={{
                      fontSize: '13px',
                      fontStyle: 'italic',
                      color: 'var(--type-faint, #74827E)',
                      padding: '2px 0',
                    }}
                  >
                    Message deleted
                  </div>
                ) : isEditing ? (
                  <div style={{ marginTop: '4px' }}>
                    {editError && (
                      <div role="alert" style={{ fontSize: '12px', color: 'var(--danger, #CE807C)', marginBottom: '4px' }}>
                        {editError}
                      </div>
                    )}
                    <textarea
                      aria-label="Edit message body"
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSaveEdit(message.id);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEditing();
                        }
                      }}
                      rows={3}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--surface-0, #101416)',
                        border: '1px solid var(--signal, #A0BF9F)',
                        borderRadius: 'var(--radius-sm, 4px)',
                        color: 'var(--type, #E9ECE7)',
                        padding: '8px 10px',
                        fontSize: '14px',
                        fontFamily: 'var(--font-sans)',
                        lineHeight: 1.5,
                        outline: 'none',
                        resize: 'vertical',
                      }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={isSavingEdit}
                        onClick={() => handleSaveEdit(message.id)}
                      >
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelEditing}>
                        Cancel
                      </Button>
                      <span style={{ fontSize: '11px', color: 'var(--type-faint, #74827E)', alignSelf: 'center', marginLeft: 'auto' }}>
                        escape to cancel • enter to save
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '14px',
                      lineHeight: 1.55,
                      color: 'var(--type, #E9ECE7)',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {renderFormattedBody(message.body || '')}

                    {message.editedAt && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--type-faint, #74827E)',
                          marginLeft: '6px',
                          userSelect: 'none',
                        }}
                        title={`Edited at ${new Date(message.editedAt).toLocaleString()}`}
                      >
                        (edited)
                      </span>
                    )}
                  </div>
                )}

                {/* Attachments rendering */}
                {message.attachments && message.attachments.length > 0 && !message.deletedAt && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginTop: '6px',
                    }}
                  >
                    {message.attachments.map((att: AttachmentDTO) => {
                      const isImage = att.mime.startsWith('image/');
                      return isImage ? (
                        <div key={att.id} style={{ maxWidth: '380px' }}>
                          <img
                            src={`/api/v1/attachments/${att.id}`}
                            alt={att.originalFilename}
                            loading="lazy"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '280px',
                              borderRadius: 'var(--radius-md, 6px)',
                              border: '1px solid var(--stroke, #303B3E)',
                              display: 'block',
                            }}
                          />
                        </div>
                      ) : (
                        <a
                          key={att.id}
                          href={`/api/v1/attachments/${att.id}`}
                          download={att.originalFilename}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            backgroundColor: 'var(--surface-raised, #222B2D)',
                            border: '1px solid var(--stroke, #303B3E)',
                            borderRadius: 'var(--radius-md, 6px)',
                            textDecoration: 'none',
                            color: 'var(--type, #E9ECE7)',
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="12" y1="18" x2="12" y2="12" />
                            <line x1="9" y1="15" x2="15" y2="15" />
                          </svg>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 500 }}>{att.originalFilename}</div>
                            <div style={{ fontSize: '11px', color: 'var(--type-faint, #74827E)' }}>
                              {(att.byteLength / 1024).toFixed(0)} KB • Download
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Floating message action buttons (hover or focus) */}
                {isHovered && !message.deletedAt && !isEditing && canManageMessage && (
                  <div
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '-12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2px',
                      backgroundColor: 'var(--surface-raised, #222B2D)',
                      border: '1px solid var(--stroke, #303B3E)',
                      borderRadius: 'var(--radius-sm, 4px)',
                      padding: '2px 4px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                      zIndex: 5,
                    }}
                  >
                    {isOwnMessage && (
                      <button
                        type="button"
                        onClick={() => startEditing(message)}
                        aria-label="Edit message"
                        title="Edit message"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '3px',
                          color: 'var(--type-muted, #9FAAA6)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--type, #E9ECE7)';
                          e.currentTarget.style.backgroundColor = 'var(--surface-2, #1B2224)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--type-muted, #9FAAA6)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteMessage(message.id)}
                      aria-label="Delete message"
                      title="Delete message"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '3px',
                        color: 'var(--danger, #CE807C)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(206, 128, 124, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} style={{ height: '1px' }} />
      </div>

      {/* Floating "New messages ↓" pill */}
      {showScrollBottomPill && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '24px',
            zIndex: 10,
          }}
        >
          <Button
            variant="primary"
            size="sm"
            onClick={scrollToBottom}
            style={{
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
              fontWeight: 600,
            }}
          >
            New messages ↓
          </Button>
        </div>
      )}
    </div>
  );
};

export default MessageTimeline;
