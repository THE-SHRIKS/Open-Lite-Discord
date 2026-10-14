import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { closeDb, getDb } from './index.js';
import { runMigrations } from './migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

export async function resetDatabase(options?: { confirm?: boolean; silent?: boolean }): Promise<void> {
  const dataDir = path.resolve(config.DATA_DIR);

  // Safety checks
  const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
  if (dataDir === '/' || (homeDir && dataDir === path.resolve(homeDir))) {
    throw new Error(`Refusing to reset unsafe directory: ${dataDir}`);
  }

  const isSafe = dataDir.endsWith('.local-data') || dataDir.startsWith(repoRoot);
  if (!isSafe) {
    throw new Error(`Refusing to reset data directory outside repo or .local-data: ${dataDir}`);
  }

  const hasConfirmFlag = options?.confirm || process.argv.includes('--confirm');
  if (!hasConfirmFlag) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) => {
      rl.question(`Are you sure you want to completely RESET database at ${dataDir}? (type 'yes' to proceed): `, (ans) => {
        rl.close();
        resolve(ans.trim().toLowerCase());
      });
    });
    if (answer !== 'yes') {
      if (!options?.silent) console.log('Reset cancelled.');
      return;
    }
  }

  closeDb();

  // Delete DB files and uploads
  const filesToDelete = [
    'sideband.sqlite',
    'sideband.sqlite-wal',
    'sideband.sqlite-shm',
  ];

  for (const f of filesToDelete) {
    const fullPath = path.join(dataDir, f);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch {
        // ignore if already gone
      }
    }
  }

  const uploadsDir = path.join(dataDir, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    try {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  // Re-run migrations
  const newDb = getDb(dataDir);
  runMigrations(newDb);

  if (!options?.silent) {
    console.log(`[reset] Database at ${dataDir} has been reset and migrated.`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('reset.ts')) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[reset] Error resetting database:', err);
      process.exit(1);
    });
}
