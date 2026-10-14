import Database from 'better-sqlite3';
import { getDb } from './index.js';
import { runMigrations } from './migrate.js';
import { hashPassword, pickAvatarColor } from '../auth/service.js';

export async function runSeed(db: Database.Database, options?: { silent?: boolean }): Promise<void> {
  if (process.env['NODE_ENV'] === 'production' && process.env['DEMO_SEED'] !== '1') {
    throw new Error('Refusing to seed in production unless DEMO_SEED=1');
  }

  runMigrations(db);

  const password = process.env['SEED_PASSWORD'] || 'SidebandPass123!';
  if (!options?.silent) {
    console.log(`[seed] Using seed password for demo accounts: ${password}`);
  }

  const passwordHash = await hashPassword(password);

  const seedTx = db.transaction(() => {
    // 1. Create Users
    let alice = db.prepare('SELECT id, username FROM users WHERE username = ? COLLATE NOCASE').get('alice') as
      | { id: string; username: string }
      | undefined;

    if (!alice) {
      const aliceId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO users (id, username, display_name, password_hash, avatar_color)
        VALUES (?, ?, ?, ?, ?)
      `).run(aliceId, 'alice', 'Alice Vance', passwordHash, pickAvatarColor('alice'));
      alice = { id: aliceId, username: 'alice' };
    }

    let bob = db.prepare('SELECT id, username FROM users WHERE username = ? COLLATE NOCASE').get('bob') as
      | { id: string; username: string }
      | undefined;

    if (!bob) {
      const bobId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO users (id, username, display_name, password_hash, avatar_color)
        VALUES (?, ?, ?, ?, ?)
      `).run(bobId, 'bob', 'Bob Mercer', passwordHash, pickAvatarColor('bob'));
      bob = { id: bobId, username: 'bob' };
    }

    // 2. Create Space
    let space = db.prepare('SELECT id FROM spaces WHERE slug = ?').get('sideband-signal-lab') as
      | { id: string }
      | undefined;

    if (!space) {
      const spaceId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO spaces (id, name, slug, owner_id, icon_text)
        VALUES (?, ?, ?, ?, ?)
      `).run(spaceId, 'SIDEBAND Signal Lab', 'sideband-signal-lab', alice.id, 'SL');
      space = { id: spaceId };
    }

    // Space Memberships
    db.prepare(`
      INSERT INTO space_members (space_id, user_id, role)
      VALUES (?, ?, ?)
      ON CONFLICT DO UPDATE SET role = excluded.role
    `).run(space.id, alice.id, 'owner');

    db.prepare(`
      INSERT INTO space_members (space_id, user_id, role)
      VALUES (?, ?, ?)
      ON CONFLICT DO UPDATE SET role = excluded.role
    `).run(space.id, bob.id, 'member');

    // 3. Channels
    interface ChannelRecord {
      id: string;
      name: string;
      topic: string;
      visibility: 'public' | 'private';
      order: number;
    }

    const channelsDef: ChannelRecord[] = [
      { id: crypto.randomUUID(), name: 'general', topic: 'General community discussion and lab updates', visibility: 'public', order: 1 },
      { id: crypto.randomUUID(), name: 'build-log', topic: 'Technical architecture, builds and benchmarks', visibility: 'public', order: 2 },
      { id: crypto.randomUUID(), name: 'core-security', topic: 'Confidential protocol and security review', visibility: 'private', order: 3 },
    ];

    const channelMap = new Map<string, string>();

    for (const c of channelsDef) {
      const existing = db.prepare('SELECT id FROM channels WHERE space_id = ? AND name = ?').get(space.id, c.name) as
        | { id: string }
        | undefined;

      if (!existing) {
        db.prepare(`
          INSERT INTO channels (id, space_id, name, topic, visibility, channel_order, last_sequence)
          VALUES (?, ?, ?, ?, ?, ?, 0)
        `).run(c.id, space.id, c.name, c.topic, c.visibility, c.order);
        channelMap.set(c.name, c.id);

        if (c.visibility === 'private') {
          db.prepare(`
            INSERT INTO channel_members (channel_id, user_id)
            VALUES (?, ?)
            ON CONFLICT DO NOTHING
          `).run(c.id, alice.id);
        }
      } else {
        channelMap.set(c.name, existing.id);
      }
    }

    // 4. Discussion Messages (15 messages total)
    const generalId = channelMap.get('general')!;
    const buildLogId = channelMap.get('build-log')!;
    const coreSecId = channelMap.get('core-security')!;

    const existingMsgCount = (db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }).count;
    if (existingMsgCount === 0) {
      const messagesToSeed = [
        // General (6 messages)
        { channelId: generalId, authorId: alice.id, body: 'Welcome to SIDEBAND Signal Lab. Zero cloud dependencies, fully local mesh architecture.' },
        { channelId: generalId, authorId: bob.id, body: 'Checking in from the lab workstation. Fastify + SQLite WAL is performing nicely.' },
        { channelId: generalId, authorId: alice.id, body: 'Let us keep all message sequence numbers strictly sequential per channel.' },
        { channelId: generalId, authorId: bob.id, body: 'Agreed. Transactional sequence increments prevent any off-by-one gaps during reconnects.' },
        { channelId: generalId, authorId: alice.id, body: 'Remember to verify dark theme tokens and avoid un-themed component imports.' },
        { channelId: generalId, authorId: bob.id, body: 'All UI components follow the specified monochromatic design system.' },

        // Build Log (5 messages)
        { channelId: buildLogId, authorId: alice.id, body: 'Benchmarking SQLite WAL with memory-mapped I/O and synchronous=NORMAL.' },
        { channelId: buildLogId, authorId: bob.id, body: 'Latency on local message insertion is sub-millisecond with better-sqlite3.' },
        { channelId: buildLogId, authorId: alice.id, body: 'Contracts package type sharing works smoothly across server and web workspaces.' },
        { channelId: buildLogId, authorId: bob.id, body: 'Added Playwright tests to simulate multi-browser client sync.' },
        { channelId: buildLogId, authorId: alice.id, body: 'Build log updated. Ready for offline validation pass.' },

        // Core Security (4 messages)
        { channelId: coreSecId, authorId: alice.id, body: 'Confidential: Scrypt parameters configured to N=16384, r=8, p=1.' },
        { channelId: coreSecId, authorId: alice.id, body: 'CSRF Origin verification blocks cross-site form submissions on all mutating endpoints.' },
        { channelId: coreSecId, authorId: alice.id, body: 'Private channel isolation verified: unauthorized members cannot read or subscribe to socket rooms.' },
        { channelId: coreSecId, authorId: alice.id, body: 'Attachment uploads sanitized: path traversal blocked and MIME types strictly allowlisted.' },
      ];

      for (const m of messagesToSeed) {
        db.prepare('UPDATE channels SET last_sequence = last_sequence + 1 WHERE id = ?').run(m.channelId);
        const seq = (db.prepare('SELECT last_sequence FROM channels WHERE id = ?').get(m.channelId) as { last_sequence: number }).last_sequence;
        const msgId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO messages (id, channel_id, author_id, body, sequence, client_nonce)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(msgId, m.channelId, m.authorId, m.body, seq, crypto.randomUUID());
      }
    }
  });

  await seedTx();
  if (!options?.silent) {
    console.log('[seed] Database seeded successfully.');
  }
}

// Direct execution
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('seed.ts')) {
  const db = getDb();
  runSeed(db)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] Error seeding database:', err);
      process.exit(1);
    });
}
