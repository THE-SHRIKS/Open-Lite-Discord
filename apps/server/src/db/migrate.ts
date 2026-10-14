import { getDb, createTestDb } from './index.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);

  const candidateDirs = [
    path.join(__dirname, 'migrations'),
    path.resolve(__dirname, '../../src/db/migrations'),
  ];
  const migrationsDir = candidateDirs.find(d => fs.existsSync(d)) ?? candidateDirs[0]!;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = db.prepare('SELECT filename FROM _migrations').all() as { filename: string }[];
  const appliedSet = new Set(applied.map(r => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    
    // Run each migration in a transaction
    const migrate = db.transaction(() => {
      // Split by semicolons but handle FTS5 CREATE VIRTUAL TABLE carefully
      // Run entire file as exec for simplicity
      try {
        db.exec(sql);
      } catch (err) {
        // FTS5 may not be available; try without FTS parts
        const noFts = sql
          .replace(/CREATE VIRTUAL TABLE.*?USING fts5[\s\S]*?;/gi, '')
          .replace(/CREATE TRIGGER.*?messages_fts[\s\S]*?END;/gi, '');
        db.exec(noFts);
        console.warn('[migrate] FTS5 not available, search will use LIKE fallback');
      }
      db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    });

    migrate();
    console.log(`[migrate] Applied: ${file}`);
  }
}

// Run migrations on the production DB if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migrate.ts')) {
  const db = getDb();
  runMigrations(db);
  console.log('[migrate] All migrations complete.');
  process.exit(0);
}
