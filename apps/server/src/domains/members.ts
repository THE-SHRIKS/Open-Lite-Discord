import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../db/index.js';
import { requireAuth } from '../auth/routes.js';
import { getSpaceRole, assertSpacePermission, auditLog } from '../auth/permissions.js';
import { getIo } from '../realtime/index.js';
import { presenceTracker } from '../realtime/index.js';
import { rejectUnauthorizedRooms } from '../realtime/authorization.js';

type AuthReq = FastifyRequest & { userId: string };

interface MemberRow {
  user_id: string;
  username: string;
  display_name: string;
  avatar_color: string;
  role: string;
  joined_at: string;
}

export async function registerMemberRoutes(app: FastifyInstance): Promise<void> {
  // Helper for role updating
  async function handleRoleUpdate(
    spaceId: string,
    targetId: string,
    newRole: string | undefined,
    actorId: string,
    reply: FastifyReply
  ) {
    const db = getDb();

    try {
      assertSpacePermission(db, spaceId, actorId, 'member:set_role');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    if (!newRole || !['admin', 'member'].includes(newRole)) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'role must be admin or member' } });
    }

    const targetMember = db.prepare('SELECT role FROM space_members WHERE space_id = ? AND user_id = ?').get(spaceId, targetId) as
      | { role: string }
      | undefined;
    if (!targetMember) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Member not found' } });
    if (targetMember.role === 'owner') {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Cannot change role of space owner' } });
    }

    const actorRole = getSpaceRole(db, spaceId, actorId);
    if (newRole === 'admin' && actorRole !== 'owner') {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Only owner can promote to admin' } });
    }

    db.prepare('UPDATE space_members SET role = ? WHERE space_id = ? AND user_id = ?').run(newRole, spaceId, targetId);

    auditLog(db, 'member:role_changed', actorId, spaceId, targetId, { role: newRole });

    // If demoted to member, check and reject unauthorized rooms
    if (newRole === 'member') {
      rejectUnauthorizedRooms(targetId);
    }

    const updated = db.prepare(`
      SELECT sm.user_id, u.username, u.display_name, u.avatar_color, sm.role, sm.joined_at
      FROM space_members sm JOIN users u ON u.id = sm.user_id
      WHERE sm.space_id = ? AND sm.user_id = ?
    `).get(spaceId, targetId) as MemberRow;

    const memberDTO = {
      userId: updated.user_id,
      username: updated.username,
      displayName: updated.display_name,
      avatarColor: updated.avatar_color,
      role: updated.role as 'owner' | 'admin' | 'member',
      joinedAt: updated.joined_at,
      isOnline: presenceTracker.isOnline(updated.user_id),
    };

    try {
      getIo().to(`space:${spaceId}`).emit('membership:updated', { spaceId, member: memberDTO });
    } catch {
      // ignore
    }

    return reply.send({ data: memberDTO });
  }

  // GET /api/v1/spaces/:id/members
  app.get('/api/v1/spaces/:id/members', { preHandler: requireAuth }, async (req, reply) => {
    const { userId } = req as AuthReq;
    const { id: spaceId } = req.params as { id: string };
    const db = getDb();

    const role = getSpaceRole(db, spaceId, userId);
    if (!role) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Not a member of this space' } });
    }

    const members = db.prepare(`
      SELECT sm.user_id, u.username, u.display_name, u.avatar_color, sm.role, sm.joined_at
      FROM space_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.space_id = ?
      ORDER BY sm.joined_at ASC
    `).all(spaceId) as MemberRow[];

    return reply.send({
      data: members.map(m => ({
        userId: m.user_id,
        username: m.username,
        displayName: m.display_name,
        avatarColor: m.avatar_color,
        role: m.role,
        joinedAt: m.joined_at,
        isOnline: presenceTracker.isOnline(m.user_id),
      })),
    });
  });

  // PATCH /api/v1/spaces/:id/members — update role via body { userId, role }
  app.patch('/api/v1/spaces/:id/members', { preHandler: requireAuth }, async (req, reply) => {
    const { userId: actorId } = req as AuthReq;
    const { id: spaceId } = req.params as { id: string };
    const body = req.body as { userId?: string; role?: string };
    if (!body?.userId) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'userId is required' } });
    }
    return handleRoleUpdate(spaceId, body.userId, body.role, actorId, reply);
  });

  // PATCH /api/v1/spaces/:id/members/:userId — update role via URL param
  app.patch('/api/v1/spaces/:id/members/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { userId: actorId } = req as AuthReq;
    const { id: spaceId, userId: targetId } = req.params as { id: string; userId: string };
    const body = req.body as { role?: string };
    return handleRoleUpdate(spaceId, targetId, body?.role, actorId, reply);
  });

  // DELETE /api/v1/spaces/:id/members/:userId — kick/remove member
  app.delete('/api/v1/spaces/:id/members/:userId', { preHandler: requireAuth }, async (req, reply) => {
    const { userId: actorId } = req as AuthReq;
    const { id: spaceId, userId: targetId } = req.params as { id: string; userId: string };
    const db = getDb();

    try {
      assertSpacePermission(db, spaceId, actorId, 'member:kick');
    } catch {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const targetMember = db.prepare('SELECT role FROM space_members WHERE space_id = ? AND user_id = ?').get(spaceId, targetId) as
      | { role: string }
      | undefined;
    if (!targetMember) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Member not found' } });

    // Cannot remove owner
    if (targetMember.role === 'owner') {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Cannot remove space owner' } });
    }

    // Admins cannot remove other admins
    const actorRole = getSpaceRole(db, spaceId, actorId);
    if (actorRole === 'admin' && (targetMember.role === 'admin' || targetMember.role === 'owner')) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Admins cannot remove other admins or owner' } });
    }

    db.prepare('DELETE FROM space_members WHERE space_id = ? AND user_id = ?').run(spaceId, targetId);
    db.prepare(`
      DELETE FROM channel_members
      WHERE user_id = ? AND channel_id IN (SELECT id FROM channels WHERE space_id = ?)
    `).run(targetId, spaceId);

    auditLog(db, 'member:removed', actorId, spaceId, targetId);

    // Eject target user from all space/channel socket rooms
    rejectUnauthorizedRooms(targetId);

    return reply.send({ data: { ok: true } });
  });
}
