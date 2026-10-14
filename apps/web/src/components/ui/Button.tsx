import React, { forwardRef } from 'react';
import Spinner from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      disabled,
      icon,
      style,
      className,
      ...props
    },
    ref
  ) => {
    const isSm = size === 'sm';

    // Base layout styles
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isSm ? '6px' : '8px',
      fontFamily: 'var(--font-sans)',
      fontWeight: 500,
      fontSize: isSm ? '12px' : '13px',
      lineHeight: '1',
      height: isSm ? '28px' : '36px',
      padding: isSm ? '0 10px' : '0 14px',
      borderRadius: 'var(--radius-md, 6px)',
      border: '1px solid transparent',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transition: 'background-color 140ms ease, border-color 140ms ease, color 140ms ease',
      userSelect: 'none',
      whiteSpace: 'nowrap',
      textDecoration: 'none',
      ...style,
    };

    // Variant style maps
    let variantStyle: React.CSSProperties = {};
    if (variant === 'primary') {
      variantStyle = {
        backgroundColor: 'var(--signal, #A0BF9F)',
        color: '#0B0D0E',
        borderColor: 'var(--signal, #A0BF9F)',
        fontWeight: 600,
      };
    } else if (variant === 'secondary') {
      variantStyle = {
        backgroundColor: 'var(--surface-raised, #222B2D)',
        color: 'var(--type, #E9ECE7)',
        borderColor: 'var(--stroke, #303B3E)',
      };
    } else if (variant === 'danger') {
      variantStyle = {
        backgroundColor: 'rgba(206, 128, 124, 0.12)',
        color: 'var(--danger, #CE807C)',
        borderColor: 'rgba(206, 128, 124, 0.35)',
      };
    } else if (variant === 'ghost') {
      variantStyle = {
        backgroundColor: 'transparent',
        color: 'var(--type-muted, #9FAAA6)',
        borderColor: 'transparent',
      };
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        style={{ ...baseStyle, ...variantStyle }}
        className={`sideband-btn sideband-btn-${variant} sideband-btn-${size} ${className ?? ''}`}
        {...props}
      >
        {isLoading ? (
          <Spinner
            size={isSm ? 13 : 15}
            color={variant === 'primary' ? '#0B0D0E' : undefined}
          />
        ) : (
          icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
