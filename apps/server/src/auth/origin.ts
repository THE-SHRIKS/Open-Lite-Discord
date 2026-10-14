import { config } from '../config.js';

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;

  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '[::1]'
    ) {
      return true;
    }

    if (config.CORS_ORIGIN) {
      const allowed = config.CORS_ORIGIN.split(',').map(s => s.trim());
      if (allowed.includes(origin) || allowed.includes(url.origin)) return true;
    }

    const publicOrigin = process.env['PUBLIC_ORIGIN'];
    if (publicOrigin) {
      const allowed = publicOrigin.split(',').map(s => s.trim());
      if (allowed.includes(origin) || allowed.includes(url.origin)) return true;
    }

    return false;
  } catch {
    return false;
  }
}
