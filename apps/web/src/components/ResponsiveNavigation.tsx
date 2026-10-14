import React, { useEffect, useRef } from 'react';

export interface ResponsiveNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const ResponsiveNavigation: React.FC<ResponsiveNavigationProps> = ({
  isOpen,
  onClose,
  children,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
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

    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = origOverflow;
      if (previouslyFocusedRef.current?.focus) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="mobile-navigation-drawer"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        display: 'flex',
      }}
      aria-modal="true"
      role="dialog"
      aria-label="Navigation drawer"
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(11, 13, 14, 0.78)',
          transition: 'opacity 160ms ease',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        ref={drawerRef}
        style={{
          position: 'relative',
          display: 'flex',
          height: '100%',
          zIndex: 901,
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.65)',
          animation: 'sideband-slide-in 160ms ease-out',
        }}
      >
        {children}
      </div>

      <style>{`
        @keyframes sideband-slide-in {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          div {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ResponsiveNavigation;
