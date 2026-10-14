import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MemberDTO, AuditEventDTO } from '@sideband/contracts';
import api from '../../hooks/useApi';
import RoleEditor from './RoleEditor';
import Spinner from '../../components/ui/Spinner';

export interface MemberPanelProps {
  spaceId: string;
  currentUserRole?: 'owner' | 'admin' | 'member';
  onClose?: () => void;
}

export const MemberPanel: React.FC<MemberPanelProps> = ({
  spaceId,
  currentUserRole = 'member',
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'members' | 'audit'>('members');
  const [selectedMember, setSelectedMember] = useState<MemberDTO | null>(null);

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  // Members Query
  const { data: members = [], isLoading: isLoadingMembers } = useQuery<MemberDTO[]>({
    queryKey: ['members', spaceId],
    queryFn: () => api.get<MemberDTO[]>(`/api/v1/spaces/${spaceId}/members`),
    staleTime: 30_000,
  });

  // Audit Log Query
  const { data: auditEvents = [], isLoading: isLoadingAudit } = useQuery<AuditEventDTO[]>({
    queryKey: ['audit', spaceId],
    queryFn: async () => {
      try {
        return await api.get<AuditEventDTO[]>(`/api/v1/spaces/${spaceId}/audit`);
      } catch {
        return [];
      }
    },
    enabled: activeTab === 'audit',
    staleTime: 15_000,
  });

  const owners = members.filter((m) => m.role === 'owner');
  const admins = members.filter((m) => m.role === 'admin');
  const regularMembers = members.filter((m) => m.role === 'member');

  const renderMemberGroup = (title: string, groupMembers: MemberDTO[]) => {
    if (groupMembers.length === 0) return null;

    return (
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--type-faint, #74827E)',
            padding: '4px 12px',
          }}
        >
          {title} — {groupMembers.length}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {groupMembers.map((member) => (
            <div
              key={member.userId}
              onClick={() => {
                if (canManage) {
                  setSelectedMember(member);
                }
              }}
              role={canManage ? 'button' : undefined}
              tabIndex={canManage ? 0 : undefined}
              onKeyDown={(e) => {
                if (canManage && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setSelectedMember(member);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm, 4px)',
                cursor: canManage ? 'pointer' : 'default',
                transition: 'background-color 100ms ease',
              }}
              onMouseEnter={(e) => {
                if (canManage) {
                  e.currentTarget.style.backgroundColor = 'var(--surface-2, #1B2224)';
                }
              }}
              onMouseLeave={(e) => {
                if (canManage) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {/* Avatar with online indicator */}
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: 'var(--radius-sm, 4px)',
                    backgroundColor: member.avatarColor || 'var(--surface-raised, #222B2D)',
                    color: '#0B0D0E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  {(member.displayName || member.username).slice(0, 2).toUpperCase()}
                </div>

                {/* Online status indicator dot */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    border: '1.5px solid var(--surface-1, #151A1C)',
                    backgroundColor: member.isOnline
                      ? 'var(--signal, #A0BF9F)'
                      : 'var(--type-faint, #74827E)',
                  }}
                  title={member.isOnline ? 'Online' : 'Offline'}
                />
              </div>

              {/* Names */}
              <div style={{ minWidth: 0, overflow: 'hidden', flex: 1 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--type, #E9ECE7)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {member.displayName}
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
                  @{member.username}
                </div>
              </div>

              {/* Edit cue for managers */}
              {canManage && (
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--type-faint, #74827E)',
                    opacity: 0.5,
                  }}
                >
                  ✎
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <aside
      aria-label="Workspace members"
      style={{
        width: 'var(--member-width, 264px)',
        minWidth: 'var(--member-width, 264px)',
        height: '100%',
        backgroundColor: 'var(--surface-1, #151A1C)',
        borderLeft: '1px solid var(--stroke, #303B3E)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Header with tabs */}
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
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            style={{
              fontSize: '13px',
              fontWeight: activeTab === 'members' ? 600 : 500,
              color: activeTab === 'members' ? 'var(--type, #E9ECE7)' : 'var(--type-muted, #9FAAA6)',
              borderBottom: activeTab === 'members' ? '2px solid var(--signal, #A0BF9F)' : '2px solid transparent',
              paddingBottom: '4px',
            }}
          >
            Members
          </button>

          {canManage && (
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              style={{
                fontSize: '13px',
                fontWeight: activeTab === 'audit' ? 600 : 500,
                color: activeTab === 'audit' ? 'var(--type, #E9ECE7)' : 'var(--type-muted, #9FAAA6)',
                borderBottom: activeTab === 'audit' ? '2px solid var(--signal, #A0BF9F)' : '2px solid transparent',
                paddingBottom: '4px',
              }}
            >
              Audit Log
            </button>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            title="Close sidebar"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px' }}>
        {activeTab === 'members' ? (
          isLoadingMembers ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
              <Spinner size={20} />
            </div>
          ) : (
            <div>
              {renderMemberGroup('Owner', owners)}
              {renderMemberGroup('Admins', admins)}
              {renderMemberGroup('Members', regularMembers)}
            </div>
          )
        ) : (
          /* Audit Log Tab */
          <div>
            {isLoadingAudit ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                <Spinner size={20} />
              </div>
            ) : auditEvents.length === 0 ? (
              <div
                style={{
                  padding: '24px 12px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'var(--type-faint, #74827E)',
                }}
              >
                No audit events recorded yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {auditEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: 'var(--surface-0, #101416)',
                      border: '1px solid var(--stroke, #303B3E)',
                      borderRadius: 'var(--radius-sm, 4px)',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          color: 'var(--signal, #A0BF9F)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                        }}
                      >
                        {event.action}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--type-faint, #74827E)' }}>
                        {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ color: 'var(--type-muted, #9FAAA6)', fontSize: '11px' }}>
                      Actor: @{event.actorUsername || 'system'}
                    </div>

                    {event.metadataJson && (
                      <pre
                        style={{
                          marginTop: '4px',
                          padding: '4px 6px',
                          backgroundColor: 'var(--surface-raised, #222B2D)',
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--type-faint, #74827E)',
                          borderRadius: '2px',
                          overflowX: 'auto',
                        }}
                      >
                        {event.metadataJson}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Role Editor Modal */}
      {selectedMember && (
        <RoleEditor
          isOpen={Boolean(selectedMember)}
          onClose={() => setSelectedMember(null)}
          spaceId={spaceId}
          member={selectedMember}
          currentUserRole={currentUserRole}
          onRoleUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['members', spaceId] });
            queryClient.invalidateQueries({ queryKey: ['audit', spaceId] });
          }}
        />
      )}
    </aside>
  );
};

export default MemberPanel;
