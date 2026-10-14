import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SpaceDTO } from '@sideband/contracts';
import api, { ApiException } from '../../hooks/useApi';
import SidebandIcon from '../../components/icons/SidebandIcon';
import Dialog from '../../components/ui/Dialog';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export interface SpaceRailProps {
  activeSpaceId?: string;
  onSelectSpace: (spaceId: string) => void;
}

export const SpaceRail: React.FC<SpaceRailProps> = ({ activeSpaceId, onSelectSpace }) => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<'create' | 'join'>('create');

  // Create space form state
  const [spaceName, setSpaceName] = useState('');
  const [iconText, setIconText] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Join invite form state
  const [inviteInput, setInviteInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const { data: spaces = [] } = useQuery<SpaceDTO[]>({
    queryKey: ['spaces'],
    queryFn: () => api.get<SpaceDTO[]>('/api/v1/spaces'),
    staleTime: 30_000,
  });

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const name = spaceName.trim();
    if (!name) {
      setCreateError('Space name is required');
      return;
    }

    setIsCreating(true);
    try {
      const created = await api.post<SpaceDTO>('/api/v1/spaces', {
        name,
        iconText: iconText.trim() ? iconText.trim().toUpperCase() : undefined,
      });

      await queryClient.invalidateQueries({ queryKey: ['spaces'] });
      setSpaceName('');
      setIconText('');
      setIsDialogOpen(false);
      onSelectSpace(created.id);
    } catch (err) {
      if (err instanceof ApiException) {
        setCreateError(err.message || 'Failed to create workspace');
      } else {
        setCreateError('Connection error creating space');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');

    let token = inviteInput.trim();
    if (!token) {
      setJoinError('Please enter an invite token or URL');
      return;
    }

    // Extract token if user pasted full invite URL (e.g. /invite/abc or http://localhost:5173/invite/abc)
    const match = token.match(/\/invite\/([a-zA-Z0-9_-]+)/);
    if (match) {
      token = match[1];
    }

    setIsJoining(true);
    try {
      const res = await api.post<{ spaceId: string }>('/api/v1/invites/redeem', { token });
      await queryClient.invalidateQueries({ queryKey: ['spaces'] });
      setInviteInput('');
      setIsDialogOpen(false);
      onSelectSpace(res.spaceId);
    } catch (err) {
      if (err instanceof ApiException) {
        if (err.code === 'INVITE_EXPIRED') setJoinError('This invite has expired');
        else if (err.code === 'INVITE_EXHAUSTED') setJoinError('This invite has reached its maximum uses');
        else if (err.code === 'INVITE_REVOKED') setJoinError('This invite has been revoked');
        else setJoinError(err.message || 'Invalid invite token');
      } else {
        setJoinError('Connection error redeeming invite');
      }
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <nav
      aria-label="Workspaces"
      style={{
        width: 'var(--rail-width, 76px)',
        minWidth: 'var(--rail-width, 76px)',
        height: '100%',
        backgroundColor: 'var(--surface-0, #101416)',
        borderRight: '1px solid var(--stroke, #303B3E)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Brand Glyph at top */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '48px',
          height: '48px',
          marginBottom: '16px',
        }}
        title="Open Lite Discord"
      >
        <SidebandIcon size={28} />
      </div>

      {/* Divider */}
      <div
        style={{
          width: '32px',
          height: '1px',
          backgroundColor: 'var(--stroke, #303B3E)',
          marginBottom: '16px',
        }}
      />

      {/* Spaces List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          alignItems: 'center',
          flex: 1,
          width: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {spaces.map((space) => {
          const isActive = space.id === activeSpaceId;
          const displayBadge = space.iconText || space.name.slice(0, 2).toUpperCase();

          return (
            <div
              key={space.id}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              {/* Active left indicator rule */}
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    width: '3px',
                    height: '28px',
                    backgroundColor: 'var(--signal, #A0BF9F)',
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}

              <button
                type="button"
                onClick={() => onSelectSpace(space.id)}
                aria-label={space.name}
                aria-current={isActive ? 'page' : undefined}
                title={space.name}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: 'var(--radius-md, 8px)',
                  backgroundColor: isActive
                    ? 'var(--surface-2, #1B2224)'
                    : 'var(--surface-1, #151A1C)',
                  border: `1px solid ${
                    isActive ? 'var(--stroke-emphasis, #526163)' : 'var(--stroke, #303B3E)'
                  }`,
                  color: isActive ? 'var(--signal, #A0BF9F)' : 'var(--type, #E9ECE7)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 140ms ease, border-color 140ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--surface-raised, #222B2D)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--surface-1, #151A1C)';
                  }
                }}
              >
                {displayBadge}
              </button>
            </div>
          );
        })}

        {/* Add Space Button */}
        <button
          type="button"
          onClick={() => {
            setDialogTab('create');
            setIsDialogOpen(true);
          }}
          aria-label="Create space or redeem invite"
          title="Create space or join via invite"
          style={{
            width: '46px',
            height: '46px',
            borderRadius: 'var(--radius-md, 8px)',
            backgroundColor: 'transparent',
            border: '1px dashed var(--stroke-emphasis, #526163)',
            color: 'var(--type-muted, #9FAAA6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginTop: '4px',
            transition: 'border-color 140ms ease, color 140ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--signal, #A0BF9F)';
            e.currentTarget.style.color = 'var(--signal, #A0BF9F)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--stroke-emphasis, #526163)';
            e.currentTarget.style.color = 'var(--type-muted, #9FAAA6)';
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Create / Join Space Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={dialogTab === 'create' ? 'Create Space' : 'Join via Invite'}
        description={
          dialogTab === 'create'
            ? 'Set up a new workspace with dedicated discussion channels.'
            : 'Enter a valid invite token or paste an invite link to join.'
        }
      >
        {/* Tab switch */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--stroke, #303B3E)',
            marginBottom: '20px',
            gap: '16px',
          }}
        >
          <button
            type="button"
            onClick={() => setDialogTab('create')}
            style={{
              paddingBottom: '8px',
              fontSize: '13px',
              fontWeight: 500,
              color: dialogTab === 'create' ? 'var(--signal, #A0BF9F)' : 'var(--type-muted, #9FAAA6)',
              borderBottom: `2px solid ${
                dialogTab === 'create' ? 'var(--signal, #A0BF9F)' : 'transparent'
              }`,
            }}
          >
            Create New Space
          </button>
          <button
            type="button"
            onClick={() => setDialogTab('join')}
            style={{
              paddingBottom: '8px',
              fontSize: '13px',
              fontWeight: 500,
              color: dialogTab === 'join' ? 'var(--signal, #A0BF9F)' : 'var(--type-muted, #9FAAA6)',
              borderBottom: `2px solid ${
                dialogTab === 'join' ? 'var(--signal, #A0BF9F)' : 'transparent'
              }`,
            }}
          >
            Join via Invite
          </button>
        </div>

        {dialogTab === 'create' ? (
          <form onSubmit={handleCreateSpace} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {createError && (
              <div
                role="alert"
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(206, 128, 124, 0.12)',
                  border: '1px solid rgba(206, 128, 124, 0.35)',
                  borderRadius: 'var(--radius-md, 6px)',
                  color: 'var(--danger, #CE807C)',
                  fontSize: '12px',
                }}
              >
                {createError}
              </div>
            )}

            <Input
              label="Space Name"
              value={spaceName}
              onChange={(e) => setSpaceName(e.target.value)}
              placeholder="e.g. Core Engineering"
              required
              autoFocus
            />

            <Input
              label="Badge Text (optional)"
              value={iconText}
              onChange={(e) => setIconText(e.target.value)}
              placeholder="e.g. CE"
              hint="1–4 uppercase characters shown on the rail"
              maxLength={4}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isCreating}>
                Create Space
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleJoinInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {joinError && (
              <div
                role="alert"
                style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(206, 128, 124, 0.12)',
                  border: '1px solid rgba(206, 128, 124, 0.35)',
                  borderRadius: 'var(--radius-md, 6px)',
                  color: 'var(--danger, #CE807C)',
                  fontSize: '12px',
                }}
              >
                {joinError}
              </div>
            )}

            <Input
              label="Invite Token or Link"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="e.g. 5rL9-xYz... or http://localhost:5173/invite/..."
              required
              autoFocus
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isJoining}>
                Redeem & Join
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </nav>
  );
};

export default SpaceRail;
