import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  DATA_DIR: z.string().default(path.resolve(__dirname, '../../..', '.local-data')),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(8760).default(168),
  DEMO_LAN: z.string().optional().transform(v => v === '1' || v === 'true'),
  DEMO_SEED: z.string().optional().transform(v => v === '1' || v === 'true'),
  CORS_ORIGIN: z.string().optional(),
});

function loadConfig() {
  const raw = {
    NODE_ENV: process.env['NODE_ENV'],
    HOST: process.env['DEMO_LAN'] === '1' ? '0.0.0.0' : (process.env['HOST'] ?? '127.0.0.1'),
    PORT: process.env['PORT'],
    DATA_DIR: process.env['DATA_DIR'],
    SESSION_TTL_HOURS: process.env['SESSION_TTL_HOURS'],
    DEMO_LAN: process.env['DEMO_LAN'],
    DEMO_SEED: process.env['DEMO_SEED'],
    CORS_ORIGIN: process.env['CORS_ORIGIN'],
  };

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    console.error('Invalid configuration:', result.error.flatten());
    process.exit(1);
  }

  const cfg = result.data;
  if (cfg.DEMO_LAN && cfg.HOST === '0.0.0.0') {
    console.warn('[SECURITY] DEMO_LAN mode: server binding 0.0.0.0 — only use on trusted local network with throwaway credentials.');
  }

  return cfg;
}

export const config = loadConfig();
export type Config = typeof config;
