import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChannelDTO, SpaceDTO, MemberDTO, InviteDTO } from '@sideband/contracts';
import api, { ApiException } from '../../hooks/useApi';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useConnectionState } from '../messages/useConnectionState';
import Dialog from '../../components/ui/Dialog';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export interface ChannelListProps {
  spaceId: string;
  activeChannelId?: string;
  onSelectChannel: (channelId: string) => void;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
}

export const ChannelList: React.FC<ChannelListProps> = ({
  spaceId,
  activeChannelId,
  onSelectChannel,
  onOpenSearch,
  onOpenSettings,
}) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { status: connStatus } = useConnectionState();

  // Space Settings modal state
  const [isSpaceSettingsOpen, setIsSpaceSettingsOpen] = useState(false);
  const [spaceEditName, setSpaceEditName] = useState('');
  const [spaceEditIcon, setSpaceEditIcon] = useState('');
  const [spaceEditError, setSpaceEditError] = useState('');
  const [isUpdatingSpace, setIsUpdatingSpace] = useState(false);
  const [isDeletingSpace, setIsDeletingSpace] = useState(false);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteExpiresHours, setInviteExpiresHours] = useState(24);
  const [inviteMaxUses, setInviteMaxUses] = useState(10);
  const [inviteResult, setInviteResult] = useState<{ token: string; expiresAt: string } | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Create channel modal state
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelTopic, setNewChannelTopic] = useState('');
  const [newChannelVisibility, setNewChannelVisibility] = useState<'public' | 'private'>('public');
  const [channelError, setChannelError] = useState('');
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);

  // Channel settings modal state
  const [editingChannel, setEditingChannel] = useState<ChannelDTO | null>(null);
  const [editName, setEditName] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editError, setEditError] = useState('');
  const [isUpdatingChannel, setIsUpdatingChannel] = useState(false);

  // Queries
  const { data: space } = useQuery<SpaceDTO>({
    queryKey: ['spaces', spaceId],
    queryFn: () => api.get<SpaceDTO>(`/api/v1/spaces/${spaceId}`),
    staleTime: 60_000,
  });

  const { data: channels = [] } = useQuery<ChannelDTO[]>({
    queryKey: ['channels', spaceId],
    queryFn: () => api.get<ChannelDTO[]>(`/api/v1/spaces/${spaceId}/channels`),
    staleTime: 30_000,
  });

  const { data: members = [] } = useQuery<MemberDTO[]>({
    queryKey: ['members', spaceId],
    queryFn: () => api.get<MemberDTO[]>(`/api/v1/spaces/${spaceId}/members`),
    staleTime: 30_000,
    enabled: Boolean(editingChannel && editingChannel.visibility === 'private'),
  });

  const { data: channelMemberIds = [] } = useQuery<string[]>({
    queryKey: ['channel-members', editingChannel?.id],
    queryFn: () => api.get<string[]>(`/api/v1/channels/${editingChannel!.id}/members`),
    enabled: Boolean(editingChannel && editingChannel.visibility === 'private'),
  });

  const { data: activeInvites = [] } = useQuery<InviteDTO[]>({
    queryKey: ['invites', spaceId],
    queryFn: () => api.get<InviteDTO[]>(`/api/v1/spaces/${spaceId}/invites`),
    enabled: isInviteOpen,
  });

  const userRole = space?.role ?? 'member';
  const canManage = userRole === 'owner' || userRole === 'admin';
  const isOwner = userRole === 'owner';

  // Space Settings handlers
  const openSpaceSettings = () => {
    setSpaceEditName(space?.name || '');
    setSpaceEditIcon(space?.iconText || '');
    setSpaceEditError('');
    setIsSpaceSettingsOpen(true);
  };

  const handleUpdateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceEditName.trim()) {
      setSpaceEditError('Space name is required');
      return;
    }
    setIsUpdatingSpace(true);
    setSpaceEditError('');
    try {
      await api.patch(`/api/v1/spaces/${spaceId}`, {
        name: spaceEditName.trim(),
        iconText: spaceEditIcon.trim() ? spaceEditIcon.trim().toUpperCase() : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['spaces'] });
      await queryClient.invalidateQueries({ queryKey: ['spaces', spaceId] });
      setIsSpaceSettingsOpen(false);
    } catch (err) {
      if (err instanceof ApiException) {
        setSpaceEditError(err.message || 'Failed to update space');
      } else {
        setSpaceEditError('Connection error');
      }
    } finally {
      setIsUpdatingSpace(false);
    }
  };

  const handleDeleteSpace = async () => {
    if (!isOwner) return;
    setIsDeletingSpace(true);
    setSpaceEditError('');
    try {
      await api.delete(`/api/v1/spaces/${spaceId}`);
      await queryClient.invalidateQueries({ queryKey: ['spaces'] });
      setIsSpaceSettingsOpen(false);
      navigate('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiException) {
        setSpaceEditError(err.message || 'Failed to delete space');
      } else {
        setSpaceEditError('Connection error');
      }
    } finally {
      setIsDeletingSpace(false);
    }
  };

  // Invite handlers
  const handleGenerateInvite = async () => {
    setIsGeneratingInvite(true);
    setInviteError('');
    setCopiedLink(false);
    try {
      const res = await api.post<{ token: string; expiresAt: string }>(
        `/api/v1/spaces/${spaceId}/invites`,
        {
          expiresInHours: Math.min(Math.max(Number(inviteExpiresHours) || 24, 1), 168),
          maxUses: Math.min(Math.max(Number(inviteMaxUses) || 10, 1), 100),
        }
      );
      setInviteResult(res);
      await queryClient.invalidateQueries({ queryKey: ['invites', spaceId] });
    } catch (err) {
      if (err instanceof ApiException) {
        setInviteError(err.message || 'Failed to generate invite');
      } else {
        setInviteError('Connection error');
      }
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await api.delete(`/api/v1/invites/${inviteId}`);
      await queryClient.invalidateQueries({ queryKey: ['invites', spaceId] });
    } catch (err) {
      if (err instanceof ApiException) {
        setInviteError(err.message || 'Failed to revoke invite');
      }
    }
  };

  const handleCopyInvite = () => {
    if (!inviteResult) return;
    const url = `${window.location.origin}/invite/${inviteResult.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  // Create Channel handler
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setChannelError('');
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name) {
      setChannelError('Channel name is required');
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(name)) {
      setChannelError('Channel name may only contain lowercase letters, numbers, hyphens and underscores');
      return;
    }

    setIsCreatingChannel(true);
    try {
      const created = await api.post<ChannelDTO>(`/api/v1/spaces/${spaceId}/channels`, {
        name,
        topic: newChannelTopic.trim() || undefined,
        visibility: newChannelVisibility,
      });

      await queryClient.invalidateQueries({ queryKey: ['channels', spaceId] });
      setNewChannelName('');
      setNewChannelTopic('');
      setNewChannelVisibility('public');
      setIsCreateChannelOpen(false);
      onSelectChannel(created.id);
    } catch (err) {
      if (err instanceof ApiException) {
        setChannelError(err.message || 'Failed to create channel');
      } else {
        setChannelError('Connection error creating channel');
      }
    } finally {
      setIsCreatingChannel(false);
    }
  };

  // Channel edit, archive, and private member grant handlers
  const openEditChannel = (channel: ChannelDTO, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChannel(channel);
    setEditName(channel.name);
    setEditTopic(channel.topic ?? '');
    setEditError('');
  };

  const handleUpdateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChannel) return;
    setIsUpdatingChannel(true);
    setEditError('');

    try {
      await api.patch(`/api/v1/channels/${editingChannel.id}`, {
        name: editName.trim().toLowerCase().replace(/\s+/g, '-'),
        topic: editTopic.trim() || undefined,
      });

      await queryClient.invalidateQueries({ queryKey: ['channels', spaceId] });
      setEditingChannel(null);
    } catch (err) {
      if (err instanceof ApiException) {
        setEditError(err.message || 'Failed to update channel');
      } else {
        setEditError('Connection error updating channel');
      }
    } finally {
      setIsUpdatingChannel(false);
    }
  };

  const handleArchiveChannel = async () => {
    if (!editingChannel) return;
    const archivedId = editingChannel.id;

    try {
      await api.delete(`/api/v1/channels/${archivedId}`);
      await queryClient.invalidateQueries({ queryKey: ['channels', spaceId] });
      setEditingChannel(null);
      if (activeChannelId === archivedId) {
        const remaining = channels.filter((c) => !c.archivedAt && c.id !== archivedId);
        if (remaining.length > 0) {
          onSelectChannel(remaining[0].id);
        }
      }
    } catch (err) {
      if (err instanceof ApiException) {
        setEditError(err.message || 'Failed to archive channel');
      } else {
        setEditError('Connection error');
      }
    }
  };

  const handleGrantChannelMember = async (targetUserId: string) => {
    if (!editingChannel) return;
    try {
      await api.post(`/api/v1/channels/${editingChannel.id}/members`, { userId: targetUserId });
      await queryClient.invalidateQueries({ queryKey: ['channel-members', editingChannel.id] });
    } catch (err) {
      if (err instanceof ApiException) {
        setEditError(err.message || 'Failed to grant access');
      }
    }
  };

  const handleRevokeChannelMember = async (targetUserId: string) => {
    if (!editingChannel) return;
    try {
      await api.delete(`/api/v1/channels/${editingChannel.id}/members/${targetUserId}`);
      await queryClient.invalidateQueries({ queryKey: ['channel-members', editingChannel.id] });
    } catch (err) {
      if (err instanceof ApiException) {
        setEditError(err.message || 'Failed to revoke access');
      }
    }
  };

  const activeChannels = channels.filter((c) => !c.archivedAt);

  return (
    <div
      aria-label="Channel navigation"
      style={{
        width: 'var(--nav-width, 244px)',
        minWidth: 'var(--nav-width, 244px)',
        height: '100%',
        backgroundColor: 'var(--surface-1, #151A1C)',
        borderRight: '1px solid var(--stroke, #303B3E)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Space Header (72px) */}
      <div
        style={{
          height: '72px',
          minHeight: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          borderBottom: '1px solid var(--stroke, #303B3E)',
        }}
      >
        <div style={{ overflow: 'hidden', marginRight: '8px' }}>
          <div
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--type, #E9ECE7)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={space?.name || 'Workspace'}
          >
            {space?.name || 'Loading...'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '1px 5px',
                borderRadius: '3px',
                backgroundColor:
                  userRole === 'owner'
                    ? 'rgba(160, 191, 159, 0.16)'
                    : 'var(--surface-raised, #222B2D)',
                color: userRole === 'owner' ? 'var(--signal, #A0BF9F)' : 'var(--type-muted, #9FAAA6)',
                border: '1px solid var(--stroke, #303B3E)',
              }}
            >
              {userRole}
            </span>
          </div>
        </div>

        {/* Action icons in header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {canManage && (
            <button
              type="button"
              onClick={openSpaceSettings}
              aria-label="Space settings"
              title="Space settings"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm, 4px)',
                color: 'var(--type-muted, #9FAAA6)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--type, #E9ECE7)';
                e.currentTarget.style.backgroundColor = 'var(--surface-raised, #222B2D)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--type-muted, #9FAAA6)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={() => {
                setIsInviteOpen(true);
                handleGenerateInvite();
              }}
              aria-label="Invite people to space"
              title="Invite people"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm, 4px)',
                color: 'var(--type-muted, #9FAAA6)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--type, #E9ECE7)';
                e.currentTarget.style.backgroundColor = 'var(--surface-raised, #222B2D)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--type-muted, #9FAAA6)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </button>
          )}

          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search messages"
              title="Search messages (Ctrl+K)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm, 4px)',
                color: 'var(--type-muted, #9FAAA6)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--type, #E9ECE7)';
                e.currentTarget.style.backgroundColor = 'var(--surface-raised, #222B2D)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--type-muted, #9FAAA6)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Channels section list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px 8px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--type-faint, #74827E)',
            }}
          >
            Channels
          </span>

          {canManage && (
            <button
              type="button"
              onClick={() => setIsCreateChannelOpen(true)}
              aria-label="Create channel"
              title="Create channel"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: '3px',
                color: 'var(--type-muted, #9FAAA6)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--type, #E9ECE7)';
                e.currentTarget.style.backgroundColor = 'var(--surface-raised, #222B2D)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--type-muted, #9FAAA6)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>

        {activeChannels.length === 0 ? (
          <div
            style={{
              padding: '24px 8px',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--type-faint, #74827E)',
            }}
          >
            No channels in this space
          </div>
        ) : (
          activeChannels.map((channel) => {
            const isActive = channel.id === activeChannelId;
            const hasUnread = !isActive && typeof channel.unreadCount === 'number' && channel.unreadCount > 0;

            return (
              <div
                key={channel.id}
                onClick={() => onSelectChannel(channel.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectChannel(channel.id);
                  }
                }}
                aria-current={isActive ? 'true' : undefined}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: '32px',
                  padding: '0 8px 0 12px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  backgroundColor: isActive ? 'var(--surface-2, #1B2224)' : 'transparent',
                  color: isActive ? 'var(--type, #E9ECE7)' : 'var(--type-muted, #9FAAA6)',
                  cursor: 'pointer',
                  fontWeight: isActive || hasUnread ? 600 : 400,
                  fontSize: '13px',
                  borderLeft: isActive
                    ? '2px solid var(--signal, #A0BF9F)'
                    : '2px solid transparent',
                  transition: 'background-color 100ms ease, color 100ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--surface-raised, #222B2D)';
                    e.currentTarget.style.color = 'var(--type, #E9ECE7)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--type-muted, #9FAAA6)';
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: 0,
                    overflow: 'hidden',
                  }}
                >
                  {channel.visibility === 'private' ? (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ flexShrink: 0, opacity: 0.75 }}
                      aria-label="Private channel"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ) : (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        opacity: 0.65,
                        flexShrink: 0,
                      }}
                      aria-label="Public channel"
                    >
                      #
                    </span>
                  )}
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {channel.name}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {hasUnread && (
                    <span
                      style={{
                        backgroundColor: 'var(--signal, #A0BF9F)',
                        color: '#0B0D0E',
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        lineHeight: 1.2,
                      }}
                    >
                      {channel.unreadCount}
                    </span>
                  )}

                  {canManage && (
                    <button
                      type="button"
                      onClick={(e) => openEditChannel(channel, e)}
                      aria-label={`Settings for #${channel.name}`}
                      title="Channel settings"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '3px',
                        color: 'var(--type-faint, #74827E)',
                        opacity: 0.7,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'var(--type, #E9ECE7)';
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--type-faint, #74827E)';
                        e.currentTarget.style.opacity = '0.7';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User Footer Bar */}
      <div
        style={{
          height: '56px',
          padding: '0 12px',
          borderTop: '1px solid var(--stroke, #303B3E)',
          backgroundColor: 'var(--surface-0, #101416)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm, 4px)',
                backgroundColor: user?.avatarColor || 'var(--surface-raised, #222B2D)',
                color: '#0B0D0E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {(user?.displayName || user?.username || 'U').slice(0, 2).toUpperCase()}
            </div>
            {/* Status dot */}
            <span
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                border: '1.5px solid var(--surface-0, #101416)',
                backgroundColor:
                  connStatus === 'connected'
                    ? 'var(--signal, #A0BF9F)'
                    : connStatus === 'connecting'
                    ? 'var(--warning, #D5B67A)'
                    : 'var(--danger, #CE807C)',
              }}
              title={`Connection: ${connStatus}`}
            />
          </div>

          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--type, #E9ECE7)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.displayName || user?.username}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--type-faint, #74827E)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              @{user?.username}
            </div>
          </div>
        </div>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="User settings"
            title="Settings"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm, 4px)',
              color: 'var(--type-muted, #9FAAA6)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--type, #E9ECE7)';
              e.currentTarget.style.backgroundColor = 'var(--surface-raised, #222B2D)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--type-muted, #9FAAA6)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </div>

      {/* Space Settings Modal */}
      <Dialog
        isOpen={isSpaceSettingsOpen}
        onClose={() => setIsSpaceSettingsOpen(false)}
        title="Space Settings"
        description="Update workspace name, badge text, or manage space lifecycle."
      >
        <form onSubmit={handleUpdateSpace} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {spaceEditError && (
            <div role="alert" style={{ color: 'var(--danger, #CE807C)', fontSize: '12px' }}>
              {spaceEditError}
            </div>
          )}

          <Input
            label="Space Name"
            value={spaceEditName}
            onChange={(e) => setSpaceEditName(e.target.value)}
            required
          />

          <Input
            label="Badge Text"
            value={spaceEditIcon}
            onChange={(e) => setSpaceEditIcon(e.target.value)}
            maxLength={4}
            hint="1–4 uppercase characters shown on the rail"
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--stroke, #303B3E)',
              paddingTop: '16px',
              marginTop: '8px',
            }}
          >
            {isOwner && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDeleteSpace}
                isLoading={isDeletingSpace}
              >
                Delete Space
              </Button>
            )}

            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <Button type="button" variant="ghost" onClick={() => setIsSpaceSettingsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isUpdatingSpace}>
                Save Space
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      {/* Invite Modal */}
      <Dialog
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite People"
        description="Share a secure time-limited invite token or manage active workspace invites."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {inviteError && (
            <div role="alert" style={{ color: 'var(--danger, #CE807C)', fontSize: '12px' }}>
              {inviteError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Expires In (Hours)"
                type="number"
                min={1}
                max={168}
                value={String(inviteExpiresHours)}
                onChange={(e) => setInviteExpiresHours(Number(e.target.value) || 24)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label="Max Uses"
                type="number"
                min={1}
                max={100}
                value={String(inviteMaxUses)}
                onChange={(e) => setInviteMaxUses(Number(e.target.value) || 10)}
              />
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateInvite}
            isLoading={isGeneratingInvite}
            style={{ width: '100%' }}
          >
            Generate New Invite Link
          </Button>

          {inviteResult && (
            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'var(--surface-0, #101416)',
                border: '1px solid var(--stroke, #303B3E)',
                borderRadius: 'var(--radius-md, 6px)',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--type-muted, #9FAAA6)', marginBottom: '6px' }}>
                Generated Invite URL:
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <input
                  readOnly
                  aria-label="Generated invite URL"
                  value={`${window.location.origin}/invite/${inviteResult.token}`}
                  style={{
                    flex: 1,
                    height: '36px',
                    padding: '0 10px',
                    backgroundColor: 'var(--surface-1, #151A1C)',
                    color: 'var(--type, #E9ECE7)',
                    border: '1px solid var(--stroke, #303B3E)',
                    borderRadius: 'var(--radius-md, 6px)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                  }}
                />
                <Button variant="primary" onClick={handleCopyInvite}>
                  {copiedLink ? 'Copied!' : 'Copy'}
                </Button>
              </div>

              <div
                style={{
                  marginTop: '10px',
                  fontSize: '11px',
                  color: 'var(--type-faint, #74827E)',
                }}
              >
                Token: <code style={{ color: 'var(--signal, #A0BF9F)' }}>{inviteResult.token}</code>
              </div>
            </div>
          )}

          {/* Active Invites List */}
          {activeInvites.length > 0 && (
            <div style={{ borderTop: '1px solid var(--stroke, #303B3E)', paddingTop: '12px' }}>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--type-faint, #74827E)',
                  marginBottom: '8px',
                }}
              >
                Active Invites ({activeInvites.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                {activeInvites.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      backgroundColor: 'var(--surface-0, #101416)',
                      border: '1px solid var(--stroke, #303B3E)',
                      borderRadius: 'var(--radius-sm, 4px)',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--type, #E9ECE7)' }}>
                        {inv.usesRemaining} uses left
                      </span>
                      <span style={{ color: 'var(--type-faint, #74827E)', marginLeft: '8px', fontSize: '11px' }}>
                        Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleRevokeInvite(inv.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button variant="secondary" onClick={() => setIsInviteOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Create Channel Modal */}
      <Dialog
        isOpen={isCreateChannelOpen}
        onClose={() => setIsCreateChannelOpen(false)}
        title="Create Channel"
        description="Channels are where your team discusses specific projects or topics."
      >
        <form onSubmit={handleCreateChannel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {channelError && (
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
              {channelError}
            </div>
          )}

          <Input
            label="Channel Name"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            placeholder="e.g. system-architecture"
            hint="Lowercase letters, numbers, and hyphens"
            required
            autoFocus
          />

          <Input
            label="Topic (optional)"
            value={newChannelTopic}
            onChange={(e) => setNewChannelTopic(e.target.value)}
            placeholder="e.g. Core specs and protocol discussion"
            maxLength={256}
          />

          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--type-muted, #9FAAA6)',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              Channel Visibility
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  color: 'var(--type, #E9ECE7)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={newChannelVisibility === 'public'}
                  onChange={() => setNewChannelVisibility('public')}
                />
                Public (visible to everyone)
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  color: 'var(--type, #E9ECE7)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={newChannelVisibility === 'private'}
                  onChange={() => setNewChannelVisibility('private')}
                />
                Private (restricted access)
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button type="button" variant="ghost" onClick={() => setIsCreateChannelOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isCreatingChannel}>
              Create Channel
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Channel Settings Modal */}
      {editingChannel && (
        <Dialog
          isOpen={Boolean(editingChannel)}
          onClose={() => setEditingChannel(null)}
          title={`Channel Settings: #${editingChannel.name}`}
          description="Update channel properties or manage member access."
        >
          <form onSubmit={handleUpdateChannel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {editError && (
              <div role="alert" style={{ color: 'var(--danger, #CE807C)', fontSize: '12px' }}>
                {editError}
              </div>
            )}

            <Input
              label="Channel Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />

            <Input
              label="Topic"
              value={editTopic}
              onChange={(e) => setEditTopic(e.target.value)}
              placeholder="Add channel description or guidelines"
            />

            {editingChannel.visibility === 'private' && (
              <div
                style={{
                  borderTop: '1px solid var(--stroke, #303B3E)',
                  paddingTop: '14px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--type, #E9ECE7)',
                    marginBottom: '6px',
                  }}
                >
                  Private Channel Access
                </div>
                <div style={{ fontSize: '11px', color: 'var(--type-muted, #9FAAA6)', marginBottom: '10px' }}>
                  Space owners and admins automatically have access. Grant or revoke access for regular members below:
                </div>

                {members.filter((m) => m.role === 'member').length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--type-faint, #74827E)' }}>
                    No regular members in this workspace yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                    {members
                      .filter((m) => m.role === 'member')
                      .map((m) => {
                        const hasAccess = channelMemberIds.includes(m.userId);
                        return (
                          <div
                            key={m.userId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              backgroundColor: 'var(--surface-0, #101416)',
                              border: '1px solid var(--stroke, #303B3E)',
                              borderRadius: 'var(--radius-sm, 4px)',
                              fontSize: '12px',
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--type, #E9ECE7)' }}>{m.displayName}</span>
                              <span style={{ color: 'var(--type-faint, #74827E)', marginLeft: '6px' }}>
                                @{m.username}
                              </span>
                            </div>
                            {hasAccess ? (
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() => handleRevokeChannelMember(m.userId)}
                              >
                                Revoke Access
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => handleGrantChannelMember(m.userId)}
                              >
                                Grant Access
                              </Button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--stroke, #303B3E)',
                paddingTop: '16px',
                marginTop: '8px',
              }}
            >
              <Button type="button" variant="danger" size="sm" onClick={handleArchiveChannel}>
                Archive Channel
              </Button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <Button type="button" variant="ghost" onClick={() => setEditingChannel(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isUpdatingChannel}>
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};

export default ChannelList;
