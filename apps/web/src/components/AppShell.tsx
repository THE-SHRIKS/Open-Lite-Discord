import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { SpaceDTO, ChannelDTO } from '@sideband/contracts';
import api from '../hooks/useApi';
import { useConnectionState } from '../features/messages/useConnectionState';
import { useRealtimeSpace } from '../features/messages/useRealtimeMessages';
import SpaceRail from '../features/spaces/SpaceRail';
import ChannelList from '../features/channels/ChannelList';
import ResponsiveNavigation from './ResponsiveNavigation';
import MessageTimeline from '../features/messages/MessageTimeline';
import MessageComposer from '../features/messages/MessageComposer';
import MemberPanel from '../features/members/MemberPanel';
import SearchPanel from '../features/search/SearchPanel';
import SettingsPanel from '../features/settings/SettingsPanel';
import EmptyState from './ui/EmptyState';
import Spinner from './ui/Spinner';
import Button from './ui/Button';

export const AppShell: React.FC = () => {
  const { spaceId, channelId } = useParams<{ spaceId?: string; channelId?: string }>();
  const navigate = useNavigate();

  const { status: connStatus, reconnect } = useConnectionState();

  // Panels & Drawers state
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMemberPanelOpen, setIsMemberPanelOpen] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Responsive breakpoint tracking
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      const tablet = window.innerWidth <= 1024;
      setIsMobile(mobile);
      setIsTablet(tablet);
      if (tablet) {
        setIsMemberPanelOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global Ctrl+K / Cmd+K listener for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Query Spaces
  const {
    data: spaces = [],
    isLoading: isLoadingSpaces,
  } = useQuery<SpaceDTO[]>({
    queryKey: ['spaces'],
    queryFn: () => api.get<SpaceDTO[]>('/api/v1/spaces'),
    staleTime: 30_000,
  });

  // Active space calculation
  const activeSpace = spaces.find((s) => s.id === spaceId) || spaces[0];
  const currentSpaceId = spaceId || activeSpace?.id;

  // Auto-redirect to first space if none selected in URL
  useEffect(() => {
    if (!spaceId && spaces.length > 0) {
      navigate(`/app/spaces/${spaces[0].id}`, { replace: true });
    }
  }, [spaceId, spaces, navigate]);

  // Query Channels for current space
  const {
    data: channels = [],
    isLoading: isLoadingChannels,
  } = useQuery<ChannelDTO[]>({
    queryKey: ['channels', currentSpaceId],
    queryFn: () => api.get<ChannelDTO[]>(`/api/v1/spaces/${currentSpaceId}/channels`),
    enabled: Boolean(currentSpaceId),
    staleTime: 30_000,
  });

  const activeChannels = channels.filter((c) => !c.archivedAt);
  const activeChannel = activeChannels.find((c) => c.id === channelId) || activeChannels[0];

  // Subscribe to space-level realtime events even when no channel is mounted
  useRealtimeSpace(currentSpaceId, activeChannel?.id);

  // Auto-redirect to first channel in space if none selected
  useEffect(() => {
    if (currentSpaceId && !channelId && activeChannels.length > 0) {
      navigate(`/app/spaces/${currentSpaceId}/channels/${activeChannels[0].id}`, {
        replace: true,
      });
    }
  }, [currentSpaceId, channelId, activeChannels, navigate]);

  const handleSelectSpace = useCallback(
    (nextSpaceId: string) => {
      navigate(`/app/spaces/${nextSpaceId}`);
      if (isMobile) setIsMobileNavOpen(false);
    },
    [navigate, isMobile]
  );

  const handleSelectChannel = useCallback(
    (nextChannelId: string) => {
      if (currentSpaceId) {
        navigate(`/app/spaces/${currentSpaceId}/channels/${nextChannelId}`);
      }
      if (isMobile) setIsMobileNavOpen(false);
    },
    [currentSpaceId, navigate, isMobile]
  );

  const handleSelectSearchResult = useCallback(
    (targetChannelId: string, messageId: string) => {
      if (currentSpaceId) {
        navigate(`/app/spaces/${currentSpaceId}/channels/${targetChannelId}?highlight=${messageId}`);
      }
    },
    [currentSpaceId, navigate]
  );

  // Render loading state for spaces
  if (isLoadingSpaces && spaces.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--canvas, #0B0D0E)',
        }}
      >
        <Spinner size={32} />
      </div>
    );
  }

  // Render Zero Workspaces EmptyState
  if (!isLoadingSpaces && spaces.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          backgroundColor: 'var(--canvas, #0B0D0E)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex' }}>
          <SpaceRail
            activeSpaceId={undefined}
            onSelectSpace={handleSelectSpace}
          />
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
            }}
          >
            <EmptyState
              title="No workspaces yet"
              description="You are not a member of any spaces on this server. Create your first workspace using the + icon on the rail, or redeem an invitation token."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--canvas, #0B0D0E)',
      }}
    >
      {/* Desktop Space Rail & Channel List */}
      {!isMobile && (
        <>
          <SpaceRail
            activeSpaceId={currentSpaceId}
            onSelectSpace={handleSelectSpace}
          />

          {currentSpaceId && (
            <ChannelList
              spaceId={currentSpaceId}
              activeChannelId={activeChannel?.id}
              onSelectChannel={handleSelectChannel}
              onOpenSearch={() => setIsSearchOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}
        </>
      )}

      {/* Mobile Slide-Over Navigation Drawer */}
      {isMobile && (
        <ResponsiveNavigation
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
        >
          <SpaceRail
            activeSpaceId={currentSpaceId}
            onSelectSpace={handleSelectSpace}
          />
          {currentSpaceId && (
            <ChannelList
              spaceId={currentSpaceId}
              activeChannelId={activeChannel?.id}
              onSelectChannel={handleSelectChannel}
              onOpenSearch={() => {
                setIsMobileNavOpen(false);
                setIsSearchOpen(true);
              }}
              onOpenSettings={() => {
                setIsMobileNavOpen(false);
                setIsSettingsOpen(true);
              }}
            />
          )}
        </ResponsiveNavigation>
      )}

      {/* Main Stage */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minWidth: 0,
          backgroundColor: 'var(--canvas, #0B0D0E)',
        }}
      >
        {/* Connection status banner when disconnected */}
        {(connStatus === 'disconnected' || connStatus === 'error') && (
          <div
            role="status"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 16px',
              backgroundColor: 'rgba(206, 128, 124, 0.16)',
              borderBottom: '1px solid rgba(206, 128, 124, 0.35)',
              color: 'var(--danger, #CE807C)',
              fontSize: '12px',
              fontWeight: 500,
              zIndex: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--danger, #CE807C)',
                }}
              />
              <span>Connection paused • Reconnecting to local socket server...</span>
            </div>
            <Button size="sm" variant="secondary" onClick={reconnect}>
              Retry now
            </Button>
          </div>
        )}

        {/* Stage Header (72px desktop / 56px mobile) */}
        <header
          style={{
            height: isMobile ? '56px' : '72px',
            minHeight: isMobile ? '56px' : '72px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            borderBottom: '1px solid var(--stroke, #303B3E)',
            backgroundColor: 'var(--surface-0, #101416)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, overflow: 'hidden' }}>
            {/* Mobile menu drawer toggle button */}
            {isMobile && (
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                aria-label="Toggle navigation drawer"
                aria-expanded={isMobileNavOpen}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  color: 'var(--type, #E9ECE7)',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}

            {/* Active channel info */}
            {activeChannel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--type, #E9ECE7)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeChannel.visibility === 'private' ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ) : (
                    '#'
                  )}
                  {activeChannel.name}
                </span>

                <span
                  style={{
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '3px',
                    backgroundColor: 'var(--surface-raised, #222B2D)',
                    color: 'var(--type-faint, #74827E)',
                    border: '1px solid var(--stroke, #303B3E)',
                    flexShrink: 0,
                  }}
                >
                  {activeChannel.visibility}
                </span>

                {activeChannel.topic && (
                  <>
                    <span style={{ color: 'var(--stroke, #303B3E)' }}>|</span>
                    <span
                      style={{
                        fontSize: '13px',
                        color: 'var(--type-muted, #9FAAA6)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={activeChannel.topic}
                    >
                      {activeChannel.topic}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <span style={{ fontSize: '14px', color: 'var(--type-faint, #74827E)' }}>
                {isLoadingChannels ? 'Loading channels...' : 'No channel selected'}
              </span>
            )}
          </div>

          {/* Right header actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Search button */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search messages"
              title="Search (Ctrl+K)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Member drawer toggle button */}
            <button
              type="button"
              onClick={() => setIsMemberPanelOpen((prev) => !prev)}
              aria-label="Toggle members sidebar"
              title="Toggle members sidebar"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm, 4px)',
                color: isMemberPanelOpen ? 'var(--signal, #A0BF9F)' : 'var(--type-muted, #9FAAA6)',
                backgroundColor: isMemberPanelOpen ? 'var(--surface-2, #1B2224)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isMemberPanelOpen) {
                  e.currentTarget.style.color = 'var(--type, #E9ECE7)';
                  e.currentTarget.style.backgroundColor = 'var(--surface-raised, #222B2D)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isMemberPanelOpen) {
                  e.currentTarget.style.color = 'var(--type-muted, #9FAAA6)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </button>

            {/* Settings button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Settings"
              title="Settings"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content Stage (Timeline + Composer or Channel EmptyState) */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              height: '100%',
            }}
          >
            {activeChannel ? (
              <>
                <MessageTimeline
                  channelId={activeChannel.id}
                  spaceId={currentSpaceId!}
                  userRole={activeSpace?.role}
                />
                <MessageComposer
                  channelId={activeChannel.id}
                  channelName={activeChannel.name}
                />
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '32px',
                }}
              >
                <EmptyState
                  title="No channels in this space"
                  description="Use the + icon next to Channels in the sidebar to create your first communication channel."
                />
              </div>
            )}
          </div>

          {/* Member sidebar */}
          {isMemberPanelOpen && currentSpaceId && (
            <MemberPanel
              spaceId={currentSpaceId}
              currentUserRole={activeSpace?.role}
              onClose={() => setIsMemberPanelOpen(false)}
            />
          )}
        </div>
      </main>

      {/* Search Sheet */}
      {currentSpaceId && (
        <SearchPanel
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          spaceId={currentSpaceId}
          onSelectResult={handleSelectSearchResult}
        />
      )}

      {/* Settings Modal */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default AppShell;
