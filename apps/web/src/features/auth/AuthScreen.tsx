import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import api, { ApiException } from '../../hooks/useApi';
import { reconnectSocket } from '../messages/useConnectionState';
import SidebandIcon from '../../components/icons/SidebandIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export const AuthScreen: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/app';

  const { isAuthenticated, invalidate } = useCurrentUser();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState<{
    username?: string;
    displayName?: string;
    password?: string;
    general?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTarget]);

  const validate = () => {
    const errs: typeof errors = {};

    if (!username.trim()) {
      errs.username = 'Username is required';
    } else if (mode === 'register') {
      if (username.length < 2 || username.length > 32) {
        errs.username = 'Username must be between 2 and 32 characters';
      } else if (!/^[a-z0-9_-]+$/.test(username)) {
        errs.username = 'Lowercase letters, numbers, hyphens and underscores only';
      }
    }

    if (mode === 'register' && !displayName.trim()) {
      errs.displayName = 'Display name is required';
    } else if (mode === 'register' && displayName.length > 64) {
      errs.displayName = 'Display name cannot exceed 64 characters';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (mode === 'register' && password.length < 8) {
      errs.password = 'Password must be at least 8 characters long';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await api.post('/api/v1/auth/login', {
          username: username.trim(),
          password,
        });
      } else {
        await api.post('/api/v1/auth/register', {
          username: username.trim().toLowerCase(),
          displayName: displayName.trim(),
          password,
        });
      }

      await invalidate();
      reconnectSocket();
      navigate(redirectTarget, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiException) {
        if (err.status === 401 || err.code === 'UNAUTHORIZED' || err.code === 'INVALID_CREDENTIALS') {
          setErrors({ general: 'Invalid username or password' });
        } else if (err.code === 'USER_EXISTS' || err.status === 409) {
          setErrors({ username: 'This username is already taken' });
        } else {
          setErrors({ general: err.message || 'Authentication failed' });
        }
      } else {
        setErrors({ general: 'An unexpected connection error occurred' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--canvas, #0B0D0E)',
      }}
    >
      {/* Left Column: Instrument Specs & Identity */}
      <div
        className="sideband-auth-specs"
        style={{
          flex: '1 1 50%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
          backgroundColor: 'var(--surface-0, #101416)',
          borderRight: '1px solid var(--stroke, #303B3E)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <SidebandIcon size={32} />
            <div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--type, #E9ECE7)',
                }}
              >
                OPEN LITE DISCORD
              </div>
              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.14em',
                  color: 'var(--signal, #A0BF9F)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                COMMUNICATION WORKBENCH
              </div>
            </div>
          </div>

          <h1
            style={{
              fontSize: '28px',
              fontWeight: 600,
              lineHeight: 1.25,
              color: 'var(--type, #E9ECE7)',
              letterSpacing: '-0.02em',
              marginBottom: '16px',
              maxWidth: '480px',
            }}
          >
            A local-first communication workbench engineered for technical collectives.
          </h1>

          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.6,
              color: 'var(--type-muted, #9FAAA6)',
              maxWidth: '460px',
              marginBottom: '40px',
            }}
          >
            Deterministic message ordering, low-latency socket synchronization, and hardened local
            SQLite storage. Completely self-contained, air-gap ready, and free of cloud dependencies.
          </p>

          {/* Technical instrument specifications table */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxWidth: '460px',
              borderTop: '1px solid var(--stroke, #303B3E)',
              paddingTop: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--type-faint, #74827E)', letterSpacing: '0.04em' }}>
                STORAGE ENGINE
              </span>
              <span style={{ color: 'var(--type, #E9ECE7)', fontFamily: 'var(--font-mono)' }}>
                SQLite 3 (WAL + FK enforced)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--type-faint, #74827E)', letterSpacing: '0.04em' }}>
                ORDERING MODEL
              </span>
              <span style={{ color: 'var(--type, #E9ECE7)', fontFamily: 'var(--font-mono)' }}>
                Atomic per-channel sequence
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--type-faint, #74827E)', letterSpacing: '0.04em' }}>
                SECURITY & CRYPTO
              </span>
              <span style={{ color: 'var(--type, #E9ECE7)', fontFamily: 'var(--font-mono)' }}>
                Scrypt password derivation
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--type-faint, #74827E)', letterSpacing: '0.04em' }}>
                NETWORK TOPOLOGY
              </span>
              <span style={{ color: 'var(--signal, #A0BF9F)', fontFamily: 'var(--font-mono)' }}>
                Zero-telemetry / Localhost only
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: '11px',
            color: 'var(--type-faint, #74827E)',
            letterSpacing: '0.02em',
          }}
        >
          OPEN LITE DISCORD v0.1.0 • SYSTEM SPECIFICATION 2026
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div
        style={{
          flex: '1 1 50%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '32px 24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '380px',
            backgroundColor: 'var(--surface-1, #151A1C)',
            border: '1px solid var(--stroke, #303B3E)',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: '32px 28px',
          }}
        >
          {/* Header & Toggle */}
          <div style={{ marginBottom: '24px' }}>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--type, #E9ECE7)',
                letterSpacing: '-0.01em',
                marginBottom: '6px',
              }}
            >
              {mode === 'login' ? 'Sign In to Instance' : 'Create Local Account'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--type-muted, #9FAAA6)' }}>
              {mode === 'login'
                ? 'Enter your credentials to access workspaces.'
                : 'Account records are stored directly in the local database.'}
            </p>
          </div>

          {errors.general && (
            <div
              role="alert"
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(206, 128, 124, 0.12)',
                border: '1px solid rgba(206, 128, 124, 0.35)',
                borderRadius: 'var(--radius-md, 6px)',
                color: 'var(--danger, #CE807C)',
                fontSize: '12px',
                marginBottom: '20px',
                lineHeight: 1.4,
              }}
            >
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alex"
              error={errors.username}
              autoComplete="username"
              autoFocus
              required
            />

            {mode === 'register' && (
              <Input
                label="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Mercer"
                error={errors.displayName}
                hint="Your visible public nickname"
                required
              />
            )}

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              error={errors.password}
              hint={mode === 'register' ? 'Minimum 8 characters' : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              style={{ marginTop: '8px', width: '100%', height: '38px' }}
            >
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          {/* Mode Switcher */}
          <div
            style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid var(--stroke, #303B3E)',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--type-muted, #9FAAA6)',
            }}
          >
            {mode === 'login' ? (
              <span>
                Don't have an account on this server?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrors({});
                  }}
                  style={{
                    color: 'var(--signal, #A0BF9F)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                >
                  Create one
                </button>
              </span>
            ) : (
              <span>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrors({});
                  }}
                  style={{
                    color: 'var(--signal, #A0BF9F)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textDecoration: 'none',
                  }}
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .sideband-auth-specs {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AuthScreen;
