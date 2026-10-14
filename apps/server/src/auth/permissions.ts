import Database from 'better-sqlite3';
import type { Role } from '@sideband/contracts';

// ─── Centralized permission service ───────────────────────────────────────────

export type Permission =
  | 'space:read'
  | 'space:edit'
  | 'space:delete'
  | 'channel:read'
  | 'channel:create'
  | 'channel:edit'
  | 'channel:archive'
  | 'message:create'
  | 'message:edit_own'
  | 'message:delete_own'
  | 'message:moderate'
  | 'member:invite'
  | 'member:kick'
  | 'member:set_role'
  | 'invite:create'
  | 'invite:revoke';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    'space:read', 'space:edit', 'space:delete',
    'channel:read', 'channel:create', 'channel:edit', 'channel:archive',
    'message:create', 'message:edit_own', 'message:delete_own', 'message:moderate',
    'member:invite', 'member:kick', 'member:set_role',
    'invite:create', 'invite:revoke',
  ],
  admin: [
    'space:read',
    'channel:read', 'channel:create', 'channel:edit', 'channel:archive',
    'message:create', 'message:edit_own', 'message:delete_own', 'message:moderate',
    'member:invite', 'member:kick',
    'invite:create',
  ],
  member: [
    'space:read',
    'channel:read',
    'message:create', 'message:edit_own', 'message:delete_own',
  ],
};

export function getSpaceRole(db: Database.Database, spaceId: string, userId: string): Role | null {
  const row = db.prepare('SELECT role FROM space_members WHERE space_id = ? AND user_id = ?').get(spaceId, userId) as
    { role: Role } | undefined;
  return row?.role ?? null;
}

export function hasSpacePermission(
  db: Database.Database,
  spaceId: string,
  userId: string,
  permission: Permission
): boolean {
  const role = getSpaceRole(db, spaceId, userId);
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canReadChannel(
  db: Database.Database,
  channelId: string,
  userId: string
): boolean {
  const channel = db.prepare(`
    SELECT c.visibility, c.space_id FROM channels c WHERE c.id = ?
  `).get(channelId) as { visibility: 'public' | 'private'; space_id: string } | undefined;

  if (!channel) return false;

  const spaceRole = getSpaceRole(db, channel.space_id, userId);
  if (!spaceRole) return false; // not a space member

  if (channel.visibility === 'public') return true;

  // Private: check explicit channel membership or owner/admin role
  if (spaceRole === 'owner' || spaceRole === 'admin') return true;

  const grant = db.prepare('SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?').get(channelId, userId);
  return grant !== undefined;
}

export function assertSpacePermission(
  db: Database.Database,
  spaceId: string,
  userId: string,
  permission: Permission
): void {
  if (!hasSpacePermission(db, spaceId, userId, permission)) {
    throw Object.assign(new Error('Access denied'), { code: 'FORBIDDEN', status: 403 });
  }
}

export function assertChannelRead(db: Database.Database, channelId: string, userId: string): void {
  if (!canReadChannel(db, channelId, userId)) {
    throw Object.assign(new Error('Access denied'), { code: 'FORBIDDEN', status: 403 });
  }
}

export function auditLog(
  db: Database.Database,
  action: string,
  actorId: string,
  spaceId: string | null,
  targetId: string | null,
  metadata: Record<string, unknown> = {}
): void {
  db.prepare(`
    INSERT INTO audit_events (id, space_id, actor_id, action, target_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), spaceId, actorId, action, targetId, JSON.stringify(metadata));
}
