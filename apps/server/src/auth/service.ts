import { randomBytes, scrypt, timingSafeEqual, createHash } from 'crypto';
import Database from 'better-sqlite3';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dkLen: 64 };
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function scryptKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_PARAMS.dkLen,
      { N: SCRYPT_PARAMS.N, r: SCRYPT_PARAMS.r, p: SCRYPT_PARAMS.p },
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString('hex');
  const hash = await scryptKey(password, salt);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  const storedHash = Buffer.from(hashHex!, 'hex');
  try {
    const hash = await scryptKey(password, salt!);
    return timingSafeEqual(hash, storedHash);
  } catch {
    return false;
  }
}

export function generateSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, tokenHash: sha256(token) };
}

export function generateId(): string {
  return crypto.randomUUID();
}

// ─── Avatar colors ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#A0BF9F', '#7EB3B0', '#B3A07E', '#A07EB3', '#B37E7E',
  '#7E9FB3', '#B3B07E', '#9FB37E', '#7EB38D', '#A89FC4',
];

export function pickAvatarColor(username: string): string {
  let hash = 0;
  for (const ch of username) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

// ─── User registration ────────────────────────────────────────────────────────
export async function registerUser(
  db: Database.Database,
  username: string,
  displayName: string,
  password: string
): Promise<{ id: string; username: string; displayName: string; avatarColor: string }> {
  if (password.length < 8) throw Object.assign(new Error('Password too short'), { code: 'PASSWORD_TOO_SHORT', status: 400 });
  const trimmedDisplay = displayName.trim();
  if (trimmedDisplay.length < 1 || trimmedDisplay.length > 64) {
    throw Object.assign(new Error('Display name must be 1–64 characters'), { code: 'VALIDATION_ERROR', status: 400 });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (existing) throw Object.assign(new Error('Username taken'), { code: 'USERNAME_TAKEN', status: 409 });

  const id = generateId();
  const passwordHash = await hashPassword(password);
  const avatarColor = pickAvatarColor(username);
  const normalizedUsername = username.toLowerCase();

  db.prepare(`
    INSERT INTO users (id, username, display_name, password_hash, avatar_color)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, normalizedUsername, trimmedDisplay, passwordHash, avatarColor);

  return { id, username: normalizedUsername, displayName: trimmedDisplay, avatarColor };
}

// ─── Login / session creation ─────────────────────────────────────────────────
export async function loginUser(
  db: Database.Database,
  username: string,
  password: string,
  ttlMs = SESSION_TTL_MS
): Promise<{ token: string; sessionId: string; userId: string }> {
  const user = db.prepare('SELECT id, password_hash FROM users WHERE username = ? COLLATE NOCASE').get(username) as
    { id: string; password_hash: string } | undefined;

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS', status: 401 });
  }

  // Prune expired or long-revoked sessions opportunistically
  db.prepare(`
    DELETE FROM sessions
    WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now')
       OR (revoked_at IS NOT NULL AND revoked_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 day'))
  `).run();

  const { token, tokenHash } = generateSessionToken();
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_sha256, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, user.id, tokenHash, expiresAt);

  return { token, sessionId, userId: user.id };
}

// ─── Session validation ───────────────────────────────────────────────────────
export function validateSession(
  db: Database.Database,
  token: string
): { userId: string; sessionId: string } | null {
  if (!token) return null;

  const tokenHash = sha256(token);
  const session = db.prepare(`
    SELECT id, user_id, expires_at, revoked_at FROM sessions WHERE token_sha256 = ?
  `).get(tokenHash) as { id: string; user_id: string; expires_at: string; revoked_at: string | null } | undefined;

  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  return { userId: session.user_id, sessionId: session.id };
}

// ─── Logout / revoke ──────────────────────────────────────────────────────────
export function revokeSession(db: Database.Database, sessionId: string): void {
  db.prepare(`UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(sessionId);
}

// ─── Get user by ID ───────────────────────────────────────────────────────────
export function getUserById(db: Database.Database, userId: string) {
  return db.prepare('SELECT id, username, display_name, avatar_color, created_at FROM users WHERE id = ?').get(userId) as
    { id: string; username: string; display_name: string; avatar_color: string; created_at: string } | undefined;
}
