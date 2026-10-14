import React, { useRef, useState } from 'react';
import type { AttachmentDTO } from '@sideband/contracts';
import api, { ApiException } from '../../hooks/useApi';
import Spinner from '../../components/ui/Spinner';

export interface AttachmentPickerProps {
  channelId: string;
  onAttached: (attachment: AttachmentDTO) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/pdf',
]);

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  channelId,
  onAttached,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setErrorMessage(null);

    // Validation
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`File exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
      return;
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setErrorMessage('Unsupported file format. Allowed: PNG, JPEG, GIF, WebP, TXT, PDF');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      let result: AttachmentDTO;
      try {
        result = await api.upload<AttachmentDTO>(`/api/v1/channels/${channelId}/uploads`, formData);
      } catch (uploadErr) {
        if (uploadErr instanceof ApiException && uploadErr.status === 404) {
          result = await api.upload<AttachmentDTO>('/api/v1/uploads', formData);
        } else {
          throw uploadErr;
        }
      }

      onAttached(result);
    } catch (err) {
      if (err instanceof ApiException) {
        setErrorMessage(err.message || 'Failed to upload attachment');
      } else {
        setErrorMessage('Network error during upload');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.gif,.webp,.txt,.pdf,image/png,image/jpeg,image/gif,image/webp,text/plain,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
        aria-label="Attach file"
        title="Attach file (max 5MB: images, text, PDF)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-sm, 4px)',
          color: isUploading ? 'var(--signal, #A0BF9F)' : 'var(--type-muted, #9FAAA6)',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
          transition: 'color 140ms ease, background-color 140ms ease',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isUploading) {
            e.currentTarget.style.color = 'var(--type, #E9ECE7)';
            e.currentTarget.style.backgroundColor = 'var(--surface-raised, #222B2D)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isUploading) {
            e.currentTarget.style.color = 'var(--type-muted, #9FAAA6)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        {isUploading ? (
          <Spinner size={16} />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        )}
      </button>

      {errorMessage && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: '8px',
            padding: '6px 10px',
            backgroundColor: 'var(--surface-raised, #222B2D)',
            border: '1px solid var(--danger, #CE807C)',
            borderRadius: 'var(--radius-sm, 4px)',
            color: 'var(--danger, #CE807C)',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            zIndex: 10,
          }}
        >
          {errorMessage}
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{
              marginLeft: '8px',
              color: 'var(--type-muted, #9FAAA6)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default AttachmentPicker;
