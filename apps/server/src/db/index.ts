import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _db: Database.Database | null = null;
let _currentDataDir: string | null = null;

export function getDb(dataDir?: string): Database.Database {
  const dir = path.resolve(dataDir ?? path.resolve(__dirname, '../../../..', '.local-data'));
  if (_db && (!dataDir || _currentDataDir === dir)) {
    return _db;
  }
  if (_db && dataDir && _currentDataDir !== dir) {
    _db.close();
    _db = null;
  }

  fs.mkdirSync(dir, { recursive: true });

  const dbPath = path.join(dir, 'sideband.sqlite');
  const db = new Database(dbPath);

  // Performance and safety settings
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -32000'); // 32MB cache
  db.pragma('temp_store = MEMORY');

  _db = db;
  _currentDataDir = dir;
  return db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    _currentDataDir = null;
  }
}

// For tests — create fresh in-memory DB
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}
