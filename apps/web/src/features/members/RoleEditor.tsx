import React, { useState, useEffect } from 'react';
import type { MemberDTO, Role } from '@sideband/contracts';
import api, { ApiException } from '../../hooks/useApi';
import Dialog from '../../components/ui/Dialog';
import Button from '../../components/ui/Button';

export interface RoleEditorProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  member: MemberDTO | null;
  currentUserRole?: 'owner' | 'admin' | 'member';
  onRoleUpdated: () => void;
}

export const RoleEditor: React.FC<RoleEditorProps> = ({
  isOpen,
  onClose,
  spaceId,
  member,
  currentUserRole = 'member',
  onRoleUpdated,
}) => {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member'>('member');
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setSelectedRole(member.role === 'admin' ? 'admin' : 'member');
      setErrorMessage(null);
    }
  }, [member]);

  if (!member) return null;

  const isOwner = member.role === 'owner';
  const canPromoteToAdmin = currentUserRole === 'owner';
  const canKick =
    !isOwner &&
    (currentUserRole === 'owner' || (currentUserRole === 'admin' && member.role === 'member'));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOwner) return;

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      await api.patch(`/api/v1/spaces/${spaceId}/members/${member.userId}`, {
        role: selectedRole,
      });

      onRoleUpdated();
      onClose();
    } catch (err) {
      if (err instanceof ApiException) {
        setErrorMessage(err.message || 'Failed to update member role');
      } else {
        setErrorMessage('Connection error');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKick = async () => {
    if (!canKick) return;

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      await api.delete(`/api/v1/spaces/${spaceId}/members/${member.userId}`);
      onRoleUpdated();
      onClose();
    } catch (err) {
      if (err instanceof ApiException) {
        setErrorMessage(err.message || 'Failed to remove member');
      } else {
        setErrorMessage('Connection error');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage Member: ${member.displayName}`}
      description={`@${member.username} • Joined ${new Date(member.joinedAt).toLocaleDateString()}`}
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {errorMessage && (
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
            {errorMessage}
          </div>
        )}

        {isOwner ? (
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--surface-0, #101416)',
              border: '1px solid var(--stroke, #303B3E)',
              borderRadius: 'var(--radius-md, 6px)',
              fontSize: '13px',
              color: 'var(--type-muted, #9FAAA6)',
            }}
          >
            This member is the space owner. The owner role cannot be changed or transferred here.
          </div>
        ) : (
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
              Workspace Role
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--surface-0, #101416)',
                  border: `1px solid ${selectedRole === 'member' ? 'var(--signal, #A0BF9F)' : 'var(--stroke, #303B3E)'}`,
                  borderRadius: 'var(--radius-md, 6px)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value="member"
                  checked={selectedRole === 'member'}
                  onChange={() => setSelectedRole('member')}
                />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--type, #E9ECE7)' }}>Member</div>
                  <div style={{ fontSize: '11px', color: 'var(--type-faint, #74827E)' }}>
                    Standard read/write access to public channels and invited private channels.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  backgroundColor: 'var(--surface-0, #101416)',
                  border: `1px solid ${selectedRole === 'admin' ? 'var(--signal, #A0BF9F)' : 'var(--stroke, #303B3E)'}`,
                  borderRadius: 'var(--radius-md, 6px)',
                  cursor: canPromoteToAdmin ? 'pointer' : 'not-allowed',
                  opacity: canPromoteToAdmin ? 1 : 0.5,
                  fontSize: '13px',
                }}
              >
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={selectedRole === 'admin'}
                  disabled={!canPromoteToAdmin}
                  onChange={() => setSelectedRole('admin')}
                />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--type, #E9ECE7)' }}>
                    Admin {!canPromoteToAdmin && '(Owner promotion only)'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--type-faint, #74827E)' }}>
                    Can manage channels, create invites, and moderate member messages.
                  </div>
                </div>
              </label>
            </div>
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
          {canKick && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleKick}
              isLoading={isUpdating}
            >
              Remove from Space
            </Button>
          )}

          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {!isOwner && (
              <Button type="submit" variant="primary" isLoading={isUpdating}>
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </form>
    </Dialog>
  );
};

export default RoleEditor;
