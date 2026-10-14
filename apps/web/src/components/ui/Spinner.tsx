import React from 'react';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number;
  color?: string;
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 20,
  color = 'var(--signal, #A0BF9F)',
  label = 'Loading...',
  style,
  ...props
}) => {
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        ...style,
      }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        style={{
          animation: 'sideband-spin 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite',
        }}
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke="var(--stroke, #303B3E)"
          strokeWidth="2.5"
        />
        <path
          d="M 12 2.5 A 9.5 9.5 0 0 1 21.5 12"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <style>{`
        @keyframes sideband-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          svg {
            animation: none !important;
          }
        }
      `}</style>
    </span>
  );
};

export default Spinner;
