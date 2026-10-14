import React, { forwardRef, useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id: providedId, style, className, disabled, required, ...props }, ref) => {
    const generatedId = useId();
    const inputId = providedId || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.02em',
              color: 'var(--type-muted, #9FAAA6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              {label}
              {required && (
                <span style={{ color: 'var(--signal, #A0BF9F)', marginLeft: '3px' }}>*</span>
              )}
            </span>
          </label>
        )}

        <div style={{ position: 'relative', width: '100%' }}>
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : hint ? hintId : undefined
            }
            style={{
              width: '100%',
              height: '36px',
              padding: '0 12px',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              backgroundColor: 'var(--surface-0, #101416)',
              color: 'var(--type, #E9ECE7)',
              border: `1px solid ${error ? 'var(--danger, #CE807C)' : 'var(--stroke, #303B3E)'}`,
              borderRadius: 'var(--radius-md, 6px)',
              outline: 'none',
              transition: 'border-color 140ms ease, box-shadow 140ms ease',
              opacity: disabled ? 0.5 : 1,
              ...style,
            }}
            className={`sideband-input ${error ? 'sideband-input-error' : ''} ${className ?? ''}`}
            {...props}
          />
        </div>

        {error && (
          <div
            id={errorId}
            role="alert"
            style={{
              fontSize: '12px',
              color: 'var(--danger, #CE807C)',
              lineHeight: 1.3,
            }}
          >
            {error}
          </div>
        )}

        {hint && !error && (
          <div
            id={hintId}
            style={{
              fontSize: '11px',
              color: 'var(--type-faint, #74827E)',
              lineHeight: 1.3,
            }}
          >
            {hint}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
