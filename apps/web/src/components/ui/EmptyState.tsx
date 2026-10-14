import React from 'react';
import Button, { ButtonVariant } from './Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonVariant;
  };
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  style,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '48px 24px',
        maxWidth: '440px',
        margin: '0 auto',
        ...style,
      }}
    >
      {icon && (
        <div
          style={{
            marginBottom: '16px',
            color: 'var(--type-faint, #74827E)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
      )}

      <h3
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--type, #E9ECE7)',
          letterSpacing: '-0.01em',
          marginBottom: '8px',
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            fontSize: '13px',
            lineHeight: 1.5,
            color: 'var(--type-muted, #9FAAA6)',
            marginBottom: action ? '20px' : 0,
          }}
        >
          {description}
        </p>
      )}

      {action && (
        <Button
          variant={action.variant ?? 'primary'}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
