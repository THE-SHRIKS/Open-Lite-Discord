import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AttachmentDTO, MessageDTO } from '@sideband/contracts';
import api, { ApiException } from '../../hooks/useApi';
import AttachmentPicker from './AttachmentPicker';
import TypingIndicator, { emitTyping } from './TypingIndicator';
import Button from '../../components/ui/Button';

export interface MessageComposerProps {
  channelId: string;
  channelName?: string;
  disabled?: boolean;
}

interface FailedSendState {
  body: string;
  clientNonce: string;
  attachments: AttachmentDTO[];
  error: string;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  channelId,
  channelName,
  disabled = false,
}) => {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDTO[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [failedSend, setFailedSend] = useState<FailedSendState | null>(null);

  // Auto-resize textarea to fit content
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${Math.max(nextHeight, 38)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [body]);

  // Reset composer when switching channels
  useEffect(() => {
    setBody('');
    setAttachments([]);
    setFailedSend(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = '38px';
    }
  }, [channelId]);

  const handleSend = async (retryState?: FailedSendState) => {
    const textToSend = retryState ? retryState.body : body.trim();
    const attachmentsToSend = retryState ? retryState.attachments : attachments;
    const nonce = retryState ? retryState.clientNonce : crypto.randomUUID();

    if (!textToSend && attachmentsToSend.length === 0) return;
    if (retryState && isSending) return;

    // Immediately clear input fields on new submission so rapid consecutive messages are never dropped or overwritten
    if (!retryState) {
      setBody('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = '38px';
        textareaRef.current.focus();
      }
    }

    setIsSending(true);
    setFailedSend(null);

    // Stop typing signal immediately on send
    emitTyping(channelId, false);

    try {
      const response = await api.post<MessageDTO>(`/api/v1/channels/${channelId}/messages`, {
        body: textToSend || ' ',
        clientNonce: nonce,
        attachmentIds: attachmentsToSend.map((a) => a.id),
      });

      // Update query cache optimistically if not already inserted by socket
      queryClient.setQueryData<MessageDTO[]>(['messages', channelId], (old = []) => {
        const exists = old.some((m) => m.id === response.id || m.clientNonce === nonce);
        if (exists) return old;
        const next = [...old, response];
        next.sort((a, b) => a.sequence - b.sequence);
        return next;
      });
    } catch (err) {
      const errMsg =
        err instanceof ApiException
          ? err.message
          : 'Failed to send message. Please retry.';

      // Preserve nonce for idempotent retry
      setFailedSend({
        body: textToSend,
        clientNonce: nonce,
        attachments: attachmentsToSend,
        error: errMsg,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    if (e.target.value.length > 0) {
      emitTyping(channelId, true);
    } else {
      emitTyping(channelId, false);
    }
  };

  const handleAddAttachment = (attachment: AttachmentDTO) => {
    setAttachments((prev) => [...prev, attachment]);
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  const canSend = (body.trim().length > 0 || attachments.length > 0) && !disabled;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        backgroundColor: 'var(--surface-1, #151A1C)',
        borderTop: '1px solid var(--stroke, #303B3E)',
        padding: '8px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
        flexShrink: 0,
      }}
    >
      {/* Typing indicator above input */}
      <div style={{ marginBottom: '4px' }}>
        <TypingIndicator channelId={channelId} />
      </div>

      {/* Failed send retry banner */}
      {failedSend && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            marginBottom: '8px',
            backgroundColor: 'rgba(206, 128, 124, 0.12)',
            border: '1px solid rgba(206, 128, 124, 0.35)',
            borderRadius: 'var(--radius-md, 6px)',
            fontSize: '12px',
            color: 'var(--danger, #CE807C)',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
            {failedSend.error}
          </span>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSend(failedSend)}
              isLoading={isSending}
            >
              Retry
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFailedSend(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Attachments preview tray */}
      {attachments.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginBottom: '8px',
          }}
        >
          {attachments.map((att) => (
            <div
              key={att.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                backgroundColor: 'var(--surface-raised, #222B2D)',
                border: '1px solid var(--stroke, #303B3E)',
                borderRadius: 'var(--radius-sm, 4px)',
                fontSize: '12px',
                color: 'var(--type, #E9ECE7)',
              }}
            >
              <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {att.originalFilename}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--type-faint, #74827E)' }}>
                ({(att.byteLength / 1024).toFixed(0)} KB)
              </span>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                aria-label={`Remove ${att.originalFilename}`}
                style={{
                  color: 'var(--type-muted, #9FAAA6)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Composer Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
          backgroundColor: 'var(--surface-0, #101416)',
          border: '1px solid var(--stroke, #303B3E)',
          borderRadius: 'var(--radius-md, 8px)',
          padding: '6px 8px 6px 12px',
          minWidth: 0,
        }}
      >
        <AttachmentPicker
          channelId={channelId}
          onAttached={handleAddAttachment}
          disabled={disabled || isSending}
        />

        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={channelName ? `Message #${channelName}` : 'Write a message...'}
          aria-label="Message input"
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            minHeight: '38px',
            maxHeight: '180px',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--type, #E9ECE7)',
            fontSize: '14px',
            lineHeight: 1.45,
            fontFamily: 'var(--font-sans)',
            resize: 'none',
            padding: '8px 0',
            overflowY: 'auto',
          }}
        />

        <Button
          variant="primary"
          size="sm"
          disabled={!canSend}
          isLoading={isSending}
          onClick={() => handleSend()}
          aria-label="Send message"
          style={{ height: '32px', padding: '0 12px' }}
        >
          Send
        </Button>
      </div>

      {/* Keyboard Shortcut Hint */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '6px',
          fontSize: '11px',
          color: 'var(--type-faint, #74827E)',
          userSelect: 'none',
        }}
      >
        <span>
          <kbd style={{ fontFamily: 'var(--font-mono)' }}>Enter</kbd> to send,{' '}
          <kbd style={{ fontFamily: 'var(--font-mono)' }}>Shift+Enter</kbd> for newline
        </span>
        <span style={{ fontSize: '10px', letterSpacing: '0.04em' }}>
          LOCAL SECURE TRANSIT
        </span>
      </div>
    </div>
  );
};

export default MessageComposer;
