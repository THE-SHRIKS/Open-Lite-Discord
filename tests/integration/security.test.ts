import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { buildApp } from '../../apps/server/src/index.js';
import { closeDb } from '../../apps/server/src/db/index.js';
import { resetRateLimits } from '../../apps/server/src/auth/routes.js';
import { rejectUnauthorizedRooms } from '../../apps/server/src/realtime/authorization.js';

describe('SIDEBAND Security Integration Tests', () => {
  let tempDir: string;
  let app: any;
  let io: any;
  let db: any;

  let aliceCookie: string;
  let aliceId: string;
  let bobCookie: string;
  let bobId: string;
  let eveCookie: string;

  let spaceId: string;
  let publicChannelId: string;
  let privateChannelId: string;
  let privateAttachmentId: string;

  beforeAll(async () => {
    resetRateLimits();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sideband-security-test-'));
    const built = await buildApp({ dataDir: tempDir, logger: false });
    app = built.app;
    io = built.io;
    db = built.db;

    // 1. Register Alice (Space Owner)
    const regAlice = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'alice', displayName: 'Alice Vance', password: 'Password123!' },
    });
    aliceCookie = regAlice.headers['set-cookie'];
    aliceId = JSON.parse(regAlice.payload).data.id;

    // 2. Register Bob (Space Member)
    const regBob = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'bob', displayName: 'Bob Mercer', password: 'Password123!' },
    });
    bobCookie = regBob.headers['set-cookie'];
    bobId = JSON.parse(regBob.payload).data.id;

    // 3. Register Eve (Outsider, not in space)
    const regEve = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'eve', displayName: 'Eve Outsider', password: 'Password123!' },
    });
    eveCookie = regEve.headers['set-cookie'];

    // 4. Create Space by Alice
    const spRes = await app.inject({
      method: 'POST',
      url: '/api/v1/spaces',
      headers: { cookie: aliceCookie },
      payload: { name: 'Secured Enclave' },
    });
    spaceId = JSON.parse(spRes.payload).data.id;

    // 5. Add Bob to Space via Invite
    const invRes = await app.inject({
      method: 'POST',
      url: `/api/v1/spaces/${spaceId}/invites`,
      headers: { cookie: aliceCookie },
      payload: { expiresInHours: 1, maxUses: 1 },
    });
    const token = JSON.parse(invRes.payload).data.token;
    await app.inject({
      method: 'POST',
      url: '/api/v1/invites/redeem',
      headers: { cookie: bobCookie },
      payload: { token },
    });

    // 6. Create Public and Private Channels
    const pubRes = await app.inject({
      method: 'POST',
      url: `/api/v1/spaces/${spaceId}/channels`,
      headers: { cookie: aliceCookie },
      payload: { name: 'general', visibility: 'public' },
    });
    publicChannelId = JSON.parse(pubRes.payload).data.id;

    const privRes = await app.inject({
      method: 'POST',
      url: `/api/v1/spaces/${spaceId}/channels`,
      headers: { cookie: aliceCookie },
      payload: { name: 'top-secret', visibility: 'private' },
    });
    privateChannelId = JSON.parse(privRes.payload).data.id;

    // Alice posts a confidential message with a keyword in private channel
    await app.inject({
      method: 'POST',
      url: `/api/v1/channels/${privateChannelId}/messages`,
      headers: { cookie: aliceCookie },
      payload: { body: 'CLASSIFIED_CODE_ALPHA', clientNonce: crypto.randomUUID() },
    });

    // Upload attachment linked to private channel
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/v1/channels/${privateChannelId}/uploads`,
      headers: { cookie: aliceCookie },
      payload: {
        filename: 'secret.txt',
        mime: 'text/plain',
        content: 'Confidential document data',
      },
    });
    privateAttachmentId = JSON.parse(uploadRes.payload).data.id;
  });

  afterAll(async () => {
    closeDb();
    if (app) await app.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('1. Private Channel Isolation Across ALL Surfaces', () => {
    it('denies unauthorized space member on GET /messages', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/channels/${privateChannelId}/messages`,
        headers: { cookie: bobCookie },
      });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error.code).toBe('FORBIDDEN');
    });

    it('denies unauthorized space member on POST /messages', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/channels/${privateChannelId}/messages`,
        headers: { cookie: bobCookie },
        payload: { body: 'Bob trying to post', clientNonce: crypto.randomUUID() },
      });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error.code).toBe('FORBIDDEN');
    });

    it('excludes private channel messages from search for unauthorized member', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/search?q=CLASSIFIED_CODE_ALPHA&spaceId=${spaceId}`,
        headers: { cookie: bobCookie },
      });
      expect(res.statusCode).toBe(200);
      const results = JSON.parse(res.payload).data;
      expect(results.length).toBe(0); // Zero results for Bob
    });

    it('denies unauthorized member from downloading private attachment', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/attachments/${privateAttachmentId}`,
        headers: { cookie: bobCookie },
      });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Realtime Role & Channel Synchronization', () => {
    it('ejects revoked user from Socket.IO room and emits access:revoked', async () => {
      // Grant Bob access to private channel
      await app.inject({
        method: 'POST',
        url: `/api/v1/channels/${privateChannelId}/members`,
        headers: { cookie: aliceCookie },
        payload: { userId: bobId },
      });

      // Register mock socket in Socket.IO for Bob
      const socketEvents: { event: string; payload: any }[] = [];
      const mockBobSocket: any = {
        id: 'mock-bob-socket',
        data: { userId: bobId, username: 'bob', sessionId: 'ses-1' },
        rooms: new Set([`channel:${privateChannelId}`, `space:${spaceId}`]),
        leave(room: string) {
          this.rooms.delete(room);
        },
        emit(event: string, payload: any) {
          socketEvents.push({ event, payload });
        },
      };

      io.sockets.sockets.set(mockBobSocket.id, mockBobSocket);

      // Now Alice revokes Bob's private channel access via DELETE /channels/:id/members/:userId
      const revokeRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/channels/${privateChannelId}/members/${bobId}`,
        headers: { cookie: aliceCookie },
      });
      expect(revokeRes.statusCode).toBe(200);

      // Check that Bob's socket was removed from channel room and access:revoked was emitted
      expect(mockBobSocket.rooms.has(`channel:${privateChannelId}`)).toBe(false);
      const revokedEvent = socketEvents.find(e => e.event === 'access:revoked');
      expect(revokedEvent).toBeDefined();
      expect(revokedEvent?.payload.channelId).toBe(privateChannelId);

      // Cleanup mock socket
      io.sockets.sockets.delete(mockBobSocket.id);
    });
  });

  describe('3. Cross-Space Isolation', () => {
    it('denies non-member user Eve on space, channel, and member endpoints', async () => {
      // Eve accesses space details
      const sp = await app.inject({ method: 'GET', url: `/api/v1/spaces/${spaceId}`, headers: { cookie: eveCookie } });
      expect(sp.statusCode).toBe(403);

      // Eve accesses space channels
      const ch = await app.inject({ method: 'GET', url: `/api/v1/spaces/${spaceId}/channels`, headers: { cookie: eveCookie } });
      expect(ch.statusCode).toBe(403);

      // Eve accesses channel messages
      const msg = await app.inject({ method: 'GET', url: `/api/v1/channels/${publicChannelId}/messages`, headers: { cookie: eveCookie } });
      expect(msg.statusCode).toBe(403);

      // Eve accesses space members
      const mem = await app.inject({ method: 'GET', url: `/api/v1/spaces/${spaceId}/members`, headers: { cookie: eveCookie } });
      expect(mem.statusCode).toBe(403);
    });
  });

  describe('4. Owner Protection', () => {
    it('refuses to demote or kick space owner', async () => {
      // Bob attempts to demote Alice (owner)
      const demote = await app.inject({
        method: 'PATCH',
        url: `/api/v1/spaces/${spaceId}/members/${aliceId}`,
        headers: { cookie: bobCookie },
        payload: { role: 'member' },
      });
      expect(demote.statusCode).toBe(403);

      // Even Alice cannot demote herself as owner
      const selfDemote = await app.inject({
        method: 'PATCH',
        url: `/api/v1/spaces/${spaceId}/members/${aliceId}`,
        headers: { cookie: aliceCookie },
        payload: { role: 'member' },
      });
      expect(selfDemote.statusCode).toBe(403);

      // Alice cannot be kicked
      const kick = await app.inject({
        method: 'DELETE',
        url: `/api/v1/spaces/${spaceId}/members/${aliceId}`,
        headers: { cookie: aliceCookie },
      });
      expect(kick.statusCode).toBe(403);
    });
  });

  describe('5. Attachment Security', () => {
    it('rejects disallowed MIME type (text/html)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/uploads',
        headers: { cookie: aliceCookie },
        payload: {
          filename: 'malicious.html',
          mime: 'text/html',
          content: '<script>alert(1)</script>',
        },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.payload).error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects payload exceeding 5MB', async () => {
      const oversizedBuf = Buffer.alloc(6 * 1024 * 1024, 'a').toString('base64');
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/uploads',
        headers: { cookie: aliceCookie },
        payload: {
          filename: 'large.txt',
          mime: 'text/plain',
          contentBase64: oversizedBuf,
        },
      });
      expect(res.statusCode).toBe(413);
      expect(JSON.parse(res.payload).error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('sanitizes path traversal in originalFilename', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/uploads',
        headers: { cookie: aliceCookie },
        payload: {
          filename: '../../../../etc/passwd',
          mime: 'text/plain',
          content: 'safe content',
        },
      });
      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload).data;
      expect(data.originalFilename).not.toContain('..');
      expect(data.originalFilename).not.toContain('/');
      expect(data.originalFilename).not.toContain('\\');
    });
  });

  describe('6. Origin Verification (CSRF Defense)', () => {
    it('rejects mutating request with untrusted Origin header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/spaces',
        headers: {
          cookie: aliceCookie,
          origin: 'https://evil.example.com',
        },
        payload: { name: 'Hacked Space' },
      });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.payload).error.code).toBe('FORBIDDEN_ORIGIN');
    });

    it('allows mutating request with local localhost Origin', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/spaces',
        headers: {
          cookie: aliceCookie,
          origin: 'http://localhost:3000',
        },
        payload: { name: 'Legit Local Space' },
      });
      expect(res.statusCode).toBe(201);
    });
  });

  describe('7. Safe SQL / FTS Input Handling', () => {
    it('handles metacharacters safely without 500 error or SQL injection', async () => {
      const attackPayloads = [
        `"'; DROP TABLE messages; --`,
        `"`,
        `*`,
        `OR 1=1`,
        `NOT () : `,
        `'`,
      ];

      for (const payload of attackPayloads) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/search?q=${encodeURIComponent(payload)}&spaceId=${spaceId}`,
          headers: { cookie: aliceCookie },
        });
        expect(res.statusCode).toBe(200);
      }

      // Verify messages table still exists and is untouched
      const count = (db.prepare('SELECT COUNT(*) as c FROM messages').get() as { c: number }).c;
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('8. Unattached Upload Isolation & Rate Limiting', () => {
    it('prevents non-uploader from downloading an unattached upload and lists own uploads', async () => {
      const uploadRes = await app.inject({
        method: 'POST',
        url: '/api/v1/uploads',
        headers: { cookie: aliceCookie },
        payload: {
          filename: 'private-draft.txt',
          mime: 'text/plain',
          content: 'Confidential unattached draft',
        },
      });
      expect(uploadRes.statusCode).toBe(201);
      const attId = JSON.parse(uploadRes.payload).data.id;

      // Uploader (Alice) can list and download
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/uploads',
        headers: { cookie: aliceCookie },
      });
      expect(listRes.statusCode).toBe(200);
      expect(JSON.parse(listRes.payload).data.some((u: any) => u.id === attId)).toBe(true);

      const aliceGet = await app.inject({
        method: 'GET',
        url: `/api/v1/attachments/${attId}`,
        headers: { cookie: aliceCookie },
      });
      expect(aliceGet.statusCode).toBe(200);

      // Other user (Bob) is denied 403 on unattached file
      const bobGet = await app.inject({
        method: 'GET',
        url: `/api/v1/attachments/${attId}`,
        headers: { cookie: bobCookie },
      });
      expect(bobGet.statusCode).toBe(403);
    });

    it('enforces rate limiting on invite redemption and message creation', async () => {
      process.env.INVITE_RATE_LIMIT_MAX = '3';
      process.env.MESSAGE_RATE_LIMIT_MAX = '3';
      resetRateLimits();

      try {
        // 4 invite redeem attempts -> 4th must be 429 RATE_LIMITED
        const inviteStatuses: number[] = [];
        for (let i = 0; i < 4; i++) {
          const res = await app.inject({
            method: 'POST',
            url: '/api/v1/invites/redeem',
            headers: { cookie: bobCookie },
            payload: { token: 'nonexistent-token-rate-test' },
          });
          inviteStatuses.push(res.statusCode);
        }
        expect(inviteStatuses).toContain(429);

        // 4 message send attempts in public channel -> 4th must be 429 RATE_LIMITED
        const msgStatuses: number[] = [];
        for (let i = 0; i < 4; i++) {
          const res = await app.inject({
            method: 'POST',
            url: `/api/v1/channels/${publicChannelId}/messages`,
            headers: { cookie: aliceCookie },
            payload: { body: `Rate test ${i}`, clientNonce: crypto.randomUUID() },
          });
          msgStatuses.push(res.statusCode);
        }
        expect(msgStatuses).toContain(429);
      } finally {
        delete process.env.INVITE_RATE_LIMIT_MAX;
        delete process.env.MESSAGE_RATE_LIMIT_MAX;
        resetRateLimits();
      }
    });
  });
});
