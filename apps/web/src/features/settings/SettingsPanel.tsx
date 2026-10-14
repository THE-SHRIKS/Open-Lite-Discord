import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api, { ApiException } from '../../hooks/useApi';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { disconnectSocket } from '../messages/useConnectionState';
import Dialog from '../../components/ui/Dialog';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, invalidate } = useCurrentUser();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setDisplayName(user.displayName);
      setSaveSuccess(false);
      setSaveError(null);
    }
  }, [isOpen, user?.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setSaveError('Display name cannot be empty');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await api.patch('/api/v1/auth/me', { displayName: trimmed });
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ['members'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      if (err instanceof ApiException) {
        setSaveError(err.message || 'Failed to update profile');
      } else {
        setSaveError('Network error updating profile');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // ignore logout network errors and proceed
    } finally {
      disconnectSocket();
      queryClient.clear();
      onClose();
      navigate('/auth', { replace: true });
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Settings & System Controls"
      description="Manage your account profile and keyboard navigation preferences."
      maxWidth={520}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Section */}
        <div>
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--type-faint, #74827E)',
              marginBottom: '12px',
            }}
          >
            User Profile
          </h3>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {saveError && (
              <div role="alert" style={{ fontSize: '12px', color: 'var(--danger, #CE807C)' }}>
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div role="status" style={{ fontSize: '12px', color: 'var(--success, #A6C8AC)' }}>
                Profile display name updated successfully.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  backgroundColor: user?.avatarColor || 'var(--surface-raised, #222B2D)',
                  color: '#0B0D0E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '15px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {(user?.displayName || user?.username || 'U').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--type, #E9ECE7)' }}>
                  @{user?.username}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--type-faint, #74827E)' }}>
                  Local user ID: {user?.id}
                </div>
              </div>
            </div>

            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your nickname"
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                Save Profile
              </Button>
            </div>
          </form>
        </div>

        {/* Keyboard Shortcuts Reference */}
        <div>
          <h3
            style={{
              fontSize: '13px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--type-faint, #74827E)',
              marginBottom: '12px',
            }}
          >
            Keyboard Shortcuts
          </h3>

          <div
            style={{
              backgroundColor: 'var(--surface-0, #101416)',
              border: '1px solid var(--stroke, #303B3E)',
              borderRadius: 'var(--radius-md, 6px)',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--type-muted, #9FAAA6)' }}>Send message</span>
              <kbd style={{ fontFamily: 'var(--font-mono)', color: 'var(--type, #E9ECE7)', backgroundColor: 'var(--surface-raised, #222B2D)', padding: '1px 5px', borderRadius: '3px' }}>
                Enter
              </kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--type-muted, #9FAAA6)' }}>Insert newline</span>
              <kbd style={{ fontFamily: 'var(--font-mono)', color: 'var(--type, #E9ECE7)', backgroundColor: 'var(--surface-raised, #222B2D)', padding: '1px 5px', borderRadius: '3px' }}>
                Shift + Enter
              </kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--type-muted, #9FAAA6)' }}>Search message history</span>
              <kbd style={{ fontFamily: 'var(--font-mono)', color: 'var(--type, #E9ECE7)', backgroundColor: 'var(--surface-raised, #222B2D)', padding: '1px 5px', borderRadius: '3px' }}>
                Ctrl + K
              </kbd>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--type-muted, #9FAAA6)' }}>Close dialog or drawer</span>
              <kbd style={{ fontFamily: 'var(--font-mono)', color: 'var(--type, #E9ECE7)', backgroundColor: 'var(--surface-raised, #222B2D)', padding: '1px 5px', borderRadius: '3px' }}>
                Escape
              </kbd>
            </div>
          </div>
        </div>

        {/* Session / Sign out */}
        <div
          style={{
            borderTop: '1px solid var(--stroke, #303B3E)',
            paddingTop: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--type, #E9ECE7)' }}>
              Sign Out
            </div>
            <div style={{ fontSize: '11px', color: 'var(--type-muted, #9FAAA6)' }}>
              Terminates your active session on this local server.
            </div>
          </div>

          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleLogout}
            isLoading={isLoggingOut}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default SettingsPanel;
