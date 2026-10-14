import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  RegisterSchema,
  LoginSchema,
  CreateMessageSchema,
} from '@sideband/contracts';
import { buildApp } from '../../apps/server/src/index.js';
import { closeDb, getDb } from '../../apps/server/src/db/index.js';
import { runMigrations } from '../../apps/server/src/db/migrate.js';
import { resetRateLimits } from '../../apps/server/src/auth/routes.js';

describe('SIDEBAND Core Integration Tests', () => {
  let tempDir: string;
  let app: any;
  let db: any;

  beforeAll(async () => {
    resetRateLimits();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sideband-core-test-'));
    const built = await buildApp({ dataDir: tempDir, logger: false });
    app = built.app;
    db = built.db;
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

  describe('1. Contract Schema Validation', () => {
    it('rejects invalid usernames, short passwords, and oversized messages', () => {
      // Invalid username (uppercase, symbols)
      expect(RegisterSchema.safeParse({ username: 'Alice', displayName: 'Alice', password: 'password123' }).success).toBe(false);
      expect(RegisterSchema.safeParse({ username: 'alice@vance', displayName: 'Alice', password: 'password123' }).success).toBe(false);

      // Short password (< 8 chars)
      expect(RegisterSchema.safeParse({ username: 'alice', displayName: 'Alice', password: 'short' }).success).toBe(false);

      // Oversized message (> 8000 chars)
      const oversized = 'a'.repeat(8001);
      expect(CreateMessageSchema.safeParse({ body: oversized, clientNonce: crypto.randomUUID() }).success).toBe(false);

      // Valid payloads
      expect(RegisterSchema.safeParse({ username: 'alice_01', displayName: 'Alice Vance', password: 'validPassword123!' }).success).toBe(true);
      expect(LoginSchema.safeParse({ username: 'alice_01', password: 'validPassword123!' }).success).toBe(true);
      expect(CreateMessageSchema.safeParse({ body: 'Hello world', clientNonce: crypto.randomUUID() }).success).toBe(true);
    });
  });

  describe('2. Idempotent Migrations & Database Reopen', () => {
    it('creates all 11 required tables and runs idempotently', () => {
      // Running migrations again on already migrated DB must not throw
      expect(() => runMigrations(db)).not.toThrow();

      const tables = db.prepare(`
        SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];

      const tableNames = new Set(tables.map(t => t.name));
      const required = [
        '_migrations',
        'users',
        'sessions',
        'spaces',
        'space_members',
        'channels',
        'channel_members',
        'messages',
        'invites',
        'read_cursors',
        'attachments',
        'audit_events',
      ];

      for (const req of required) {
        expect(tableNames.has(req)).toBe(true);
      }
    });
  });

  describe('3. Auth Lifecycle', () => {
    let sessionCookie: string;

    it('registers a new user and returns cookie', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          username: 'alice',
          displayName: 'Alice Vance',
          password: 'Password123!',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.data.username).toBe('alice');
      expect(body.data.displayName).toBe('Alice Vance');

      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
      sessionCookie = Array.isArray(setCookie) ? setCookie[0]! : (setCookie as string);
      expect(sessionCookie).toContain('sideband_session=');
    });

    it('authenticates with GET /api/v1/auth/me', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { cookie: sessionCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.username).toBe('alice');
    });

    it('updates profile display name via PATCH /api/v1/auth/me', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/auth/me',
        headers: { cookie: sessionCookie },
        payload: { displayName: 'Alice Vance (Lead)' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.displayName).toBe('Alice Vance (Lead)');
    });

    it('logs out and invalidates session', async () => {
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: { cookie: sessionCookie },
      });
      expect(logoutRes.statusCode).toBe(200);

      // Subsequent /me should return 401
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { cookie: sessionCookie },
      });
      expect(meRes.statusCode).toBe(401);
    });

    it('logs back in via POST /api/v1/auth/login', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          username: 'alice',
          password: 'Password123!',
        },
      });

      expect(loginRes.statusCode).toBe(200);
      const setCookie = loginRes.headers['set-cookie'];
      sessionCookie = Array.isArray(setCookie) ? setCookie[0]! : (setCookie as string);
    });
  });

  describe('4. Spaces, Channels, and Message CRUD with Sequencing & Nonce Idempotency', () => {
    let aliceCookie: string;
    let spaceId: string;
    let channelId: string;

    beforeAll(async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'alice', password: 'Password123!' },
      });
      aliceCookie = loginRes.headers['set-cookie'];
    });

    it('creates space and channel', async () => {
      const spaceRes = await app.inject({
        method: 'POST',
        url: '/api/v1/spaces',
        headers: { cookie: aliceCookie },
        payload: { name: 'Lab 1', iconText: 'L1' },
      });
      expect(spaceRes.statusCode).toBe(201);
      spaceId = JSON.parse(spaceRes.payload).data.id;

      const chanRes = await app.inject({
        method: 'POST',
        url: `/api/v1/spaces/${spaceId}/channels`,
        headers: { cookie: aliceCookie },
        payload: { name: 'dev', topic: 'Dev channel', visibility: 'public' },
      });
      expect(chanRes.statusCode).toBe(201);
      channelId = JSON.parse(chanRes.payload).data.id;
    });

    it('increments sequence transactionally: 1, 2, 3', async () => {
      for (let i = 1; i <= 3; i++) {
        const msgRes = await app.inject({
          method: 'POST',
          url: `/api/v1/channels/${channelId}/messages`,
          headers: { cookie: aliceCookie },
          payload: { body: `Message ${i}`, clientNonce: crypto.randomUUID() },
        });
        expect(msgRes.statusCode).toBe(201);
        const data = JSON.parse(msgRes.payload).data;
        expect(data.sequence).toBe(i);
      }
    });

    it('handles idempotent retries with same clientNonce without duplicating', async () => {
      const nonce = crypto.randomUUID();
      const firstRes = await app.inject({
        method: 'POST',
        url: `/api/v1/channels/${channelId}/messages`,
        headers: { cookie: aliceCookie },
        payload: { body: 'Unique body', clientNonce: nonce },
      });
      expect(firstRes.statusCode).toBe(201);
      const firstMsg = JSON.parse(firstRes.payload).data;

      // Retry with identical clientNonce
      const secondRes = await app.inject({
        method: 'POST',
        url: `/api/v1/channels/${channelId}/messages`,
        headers: { cookie: aliceCookie },
        payload: { body: 'Unique body', clientNonce: nonce },
      });
      expect(secondRes.statusCode).toBe(200);
      const secondMsg = JSON.parse(secondRes.payload).data;

      expect(secondMsg.id).toBe(firstMsg.id);
      expect(secondMsg.sequence).toBe(firstMsg.sequence);

      // Verify DB count
      const count = (db.prepare('SELECT COUNT(*) as c FROM messages WHERE client_nonce = ?').get(nonce) as { c: number }).c;
      expect(count).toBe(1);
    });

    it('paginates correctly using before and after without skipping or duplicating', async () => {
      // Sequences now exist: 1, 2, 3, 4
      const afterRes = await app.inject({
        method: 'GET',
        url: `/api/v1/channels/${channelId}/messages?after=2&limit=2`,
        headers: { cookie: aliceCookie },
      });
      expect(afterRes.statusCode).toBe(200);
      const afterMsgs = JSON.parse(afterRes.payload).data;
      expect(afterMsgs.length).toBe(2);
      expect(afterMsgs[0].sequence).toBe(3);
      expect(afterMsgs[1].sequence).toBe(4);

      const beforeRes = await app.inject({
        method: 'GET',
        url: `/api/v1/channels/${channelId}/messages?before=4&limit=2`,
        headers: { cookie: aliceCookie },
      });
      expect(beforeRes.statusCode).toBe(200);
      const beforeMsgs = JSON.parse(beforeRes.payload).data;
      expect(beforeMsgs.length).toBe(2);
      expect(beforeMsgs[0].sequence).toBe(2);
      expect(beforeMsgs[1].sequence).toBe(3);
    });
  });

  describe('5. Message Edit and Soft-Delete', () => {
    let aliceCookie: string;
    let bobCookie: string;
    let spaceId: string;
    let channelId: string;
    let msgId: string;

    beforeAll(async () => {
      const loginA = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'alice', password: 'Password123!' } });
      aliceCookie = loginA.headers['set-cookie'];

      // Register bob
      const regB = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { username: 'bob', displayName: 'Bob Mercer', password: 'Password123!' },
      });
      bobCookie = regB.headers['set-cookie'];

      const spRes = await app.inject({
        method: 'POST',
        url: '/api/v1/spaces',
        headers: { cookie: aliceCookie },
        payload: { name: 'Edit Space' },
      });
      spaceId = JSON.parse(spRes.payload).data.id;

      const chRes = await app.inject({
        method: 'POST',
        url: `/api/v1/spaces/${spaceId}/channels`,
        headers: { cookie: aliceCookie },
        payload: { name: 'chat' },
      });
      channelId = JSON.parse(chRes.payload).data.id;

      // Add bob to space
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

      // Bob posts message
      const msgRes = await app.inject({
        method: 'POST',
        url: `/api/v1/channels/${channelId}/messages`,
        headers: { cookie: bobCookie },
        payload: { body: 'Bob original text', clientNonce: crypto.randomUUID() },
      });
      msgId = JSON.parse(msgRes.payload).data.id;
    });

    it('allows author to edit message', async () => {
      const editRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/messages/${msgId}`,
        headers: { cookie: bobCookie },
        payload: { body: 'Bob edited text' },
      });
      expect(editRes.statusCode).toBe(200);
      expect(JSON.parse(editRes.payload).data.body).toBe('Bob edited text');
      expect(JSON.parse(editRes.payload).data.editedAt).not.toBeNull();
    });

    it('allows space owner (moderator) to delete member message and sets tombstone', async () => {
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/messages/${msgId}`,
        headers: { cookie: aliceCookie },
      });
      expect(delRes.statusCode).toBe(200);

      // Verify in DB that body is NULL
      const row = db.prepare('SELECT body, deleted_at FROM messages WHERE id = ?').get(msgId) as { body: string | null; deleted_at: string | null };
      expect(row.body).toBeNull();
      expect(row.deleted_at).not.toBeNull();
    });
  });

  describe('6. Invites and Plaintext Hash Storage', () => {
    let aliceCookie: string;
    let spaceId: string;
    let token: string;
    let inviteId: string;

    beforeAll(async () => {
      const loginA = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'alice', password: 'Password123!' } });
      aliceCookie = loginA.headers['set-cookie'];

      const spRes = await app.inject({ method: 'POST', url: '/api/v1/spaces', headers: { cookie: aliceCookie }, payload: { name: 'Invite Space' } });
      spaceId = JSON.parse(spRes.payload).data.id;
    });

    it('generates invite and does NOT store plaintext token in DB', async () => {
      const invRes = await app.inject({
        method: 'POST',
        url: `/api/v1/spaces/${spaceId}/invites`,
        headers: { cookie: aliceCookie },
        payload: { expiresInHours: 24, maxUses: 1 },
      });
      expect(invRes.statusCode).toBe(201);
      const data = JSON.parse(invRes.payload).data;
      token = data.token;
      inviteId = data.id;

      // Plaintext token must not exist anywhere in invites table
      const inviteRow = db.prepare('SELECT * FROM invites WHERE id = ?').get(inviteId) as any;
      expect(inviteRow.token).toBeUndefined();
      expect(inviteRow.token_sha256).toBeDefined();
      expect(inviteRow.token_sha256).not.toBe(token);
    });

    it('allows redemption and enforces maxUses cap', async () => {
      // Register charlie
      const regC = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { username: 'charlie', displayName: 'Charlie', password: 'Password123!' },
      });
      const charlieCookie = regC.headers['set-cookie'];

      // Charlie redeems
      const redRes = await app.inject({
        method: 'POST',
        url: '/api/v1/invites/redeem',
        headers: { cookie: charlieCookie },
        payload: { token },
      });
      expect(redRes.statusCode).toBe(200);

      // Register dave
      const regD = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { username: 'dave', displayName: 'Dave', password: 'Password123!' },
      });
      const daveCookie = regD.headers['set-cookie'];

      // Dave tries to redeem exhausted invite
      const redDave = await app.inject({
        method: 'POST',
        url: '/api/v1/invites/redeem',
        headers: { cookie: daveCookie },
        payload: { token },
      });
      expect(redDave.statusCode).toBe(410);
    });
  });

  describe('7. Search and Read Cursors', () => {
    let aliceCookie: string;
    let spaceId: string;
    let channelId: string;

    beforeAll(async () => {
      const loginA = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'alice', password: 'Password123!' } });
      aliceCookie = loginA.headers['set-cookie'];

      const spRes = await app.inject({ method: 'POST', url: '/api/v1/spaces', headers: { cookie: aliceCookie }, payload: { name: 'Search Space' } });
      spaceId = JSON.parse(spRes.payload).data.id;

      const chRes = await app.inject({
        method: 'POST',
        url: `/api/v1/spaces/${spaceId}/channels`,
        headers: { cookie: aliceCookie },
        payload: { name: 'searchable-ch' },
      });
      channelId = JSON.parse(chRes.payload).data.id;

      // Post 3 messages
      await app.inject({
        method: 'POST',
        url: `/api/v1/channels/${channelId}/messages`,
        headers: { cookie: aliceCookie },
        payload: { body: 'Quantum computing milestone reached', clientNonce: crypto.randomUUID() },
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/channels/${channelId}/messages`,
        headers: { cookie: aliceCookie },
        payload: { body: 'Sideband offline protocol activated', clientNonce: crypto.randomUUID() },
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/channels/${channelId}/messages`,
        headers: { cookie: aliceCookie },
        payload: { body: 'Normal chatter', clientNonce: crypto.randomUUID() },
      });
    });

    it('searches messages and returns results with highlights', async () => {
      const searchRes = await app.inject({
        method: 'GET',
        url: `/api/v1/search?q=Quantum&spaceId=${spaceId}`,
        headers: { cookie: aliceCookie },
      });
      expect(searchRes.statusCode).toBe(200);
      const results = JSON.parse(searchRes.payload).data;
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].body).toContain('Quantum');
      expect(results[0].channelName).toBe('searchable-ch');
    });

    it('updates read cursor and computes unreadCount', async () => {
      // Channel last_sequence is 3. Alice sets read cursor to 2
      const readRes = await app.inject({
        method: 'POST',
        url: `/api/v1/channels/${channelId}/read`,
        headers: { cookie: aliceCookie },
        payload: { lastReadSequence: 2 },
      });
      expect(readRes.statusCode).toBe(200);
      expect(JSON.parse(readRes.payload).data.lastReadSequence).toBe(2);

      // GET channels should show unreadCount = 3 - 2 = 1
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/spaces/${spaceId}/channels`,
        headers: { cookie: aliceCookie },
      });
      expect(listRes.statusCode).toBe(200);
      const channels = JSON.parse(listRes.payload).data;
      const targetCh = channels.find((c: any) => c.id === channelId);
      expect(targetCh.unreadCount).toBe(1);
    });

    it('excludes soft-deleted messages from FTS5 and LIKE search', async () => {
      // Find the Quantum message and soft-delete it
      const searchBefore = await app.inject({
        method: 'GET',
        url: `/api/v1/search?q=Quantum&spaceId=${spaceId}`,
        headers: { cookie: aliceCookie },
      });
      const quantumMsgId = JSON.parse(searchBefore.payload).data[0].messageId;

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/messages/${quantumMsgId}`,
        headers: { cookie: aliceCookie },
      });
      expect(delRes.statusCode).toBe(200);

      // Search again — soft-deleted message must not appear
      const searchAfter = await app.inject({
        method: 'GET',
        url: `/api/v1/search?q=Quantum&spaceId=${spaceId}`,
        headers: { cookie: aliceCookie },
      });
      expect(searchAfter.statusCode).toBe(200);
      expect(JSON.parse(searchAfter.payload).data).toHaveLength(0);
    });

    it('allows space owner to delete space and cascades cleanup', async () => {
      const delSpaceRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/spaces/${spaceId}`,
        headers: { cookie: aliceCookie },
      });
      expect(delSpaceRes.statusCode).toBe(200);
      expect(JSON.parse(delSpaceRes.payload).data.ok).toBe(true);

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/spaces/${spaceId}`,
        headers: { cookie: aliceCookie },
      });
      expect([403, 404]).toContain(getRes.statusCode);
    });
  });
});
