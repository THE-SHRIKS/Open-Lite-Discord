import React, { useEffect, useRef, useId } from 'react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: number | string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 480,
}) => {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Manage focus trapping & restoration
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Focus first focusable element inside dialog or dialog container itself
    const dialogEl = dialogRef.current;
    if (dialogEl) {
      const focusable = dialogEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        dialogEl.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Prevent background scrolling
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = origOverflow;
      if (previouslyFocusedRef.current && previouslyFocusedRef.current.focus) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(11, 13, 14, 0.82)',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
          backgroundColor: 'var(--surface-raised, #222B2D)',
          border: '1px solid var(--stroke, #303B3E)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 48px)',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--stroke, #303B3E)',
          }}
        >
          <div>
            <h2
              id={titleId}
              style={{
                fontSize: '17px',
                fontWeight: 600,
                color: 'var(--type, #E9ECE7)',
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h2>
            {description && (
              <p
                id={descId}
                style={{
                  fontSize: '13px',
                  color: 'var(--type-muted, #9FAAA6)',
                  marginTop: '4px',
                  lineHeight: 1.4,
                }}
              >
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm, 4px)',
              color: 'var(--type-muted, #9FAAA6)',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              marginLeft: '12px',
              flexShrink: 0,
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Dialog;
