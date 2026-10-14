# Architecture / no external services

## Stack
- `apps/web`: React + TypeScript + Vite, React Router, TanStack Query (local backend only), CSS modules or plain CSS with tokens. Use one internally consistent approach.
- `apps/server`: Node.js + TypeScript + Fastify, Socket.IO attached to the HTTP server, Zod request validation.
- `packages/contracts`: shared TypeScript/Zod contracts for DTOs, events, roles and validation.
- SQLite file at `.local-data/sideband.sqlite` using `better-sqlite3`; migrations in `apps/server/src/db/migrations/` and seed script.
- `tests/e2e`: Playwright for two browser contexts and visual regression/a11y smoke.
- Root npm workspaces: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run db:migrate`, `npm run seed:demo`, `npm run verify:all`.

## Local communication
Browser (127.0.0.1:5173) -> `/api/v1` via Vite proxy -> Fastify (127.0.0.1:3001) -> SQLite. Socket.IO at `/socket.io` via same proxy with `ws:true`. All resource URLs use same-origin/relative addressing. No CDN or external fetch. Production single-server mode serves built SPA and API from the same listener port (recommended 3001); use optional LAN bind only on explicit flag.

## Data consistency
- Server generates stable UUIDs (crypto.randomUUID) and a strictly increasing per-channel `sequence` for chat ordering; use transaction for insert+sequence update.
- Message send has client-generated `clientNonce`; UNIQUE(channelId, authorId, clientNonce) gives safe retries/idempotency.
- Socket event emits **after successful DB transaction**; client refetches missing messages on reconnect using highest sequence.
- Persist read cursors per user-channel for unread calculations; do not infer read state from scroll position alone.
- Normalized server-side clocks; the UI formats local browser time.

## Engineering decisions
- Password hashing: Node built-in `scrypt` with per-password random salt, a minimum work factor, constant-time verify; session tokens stored hashed in DB, HttpOnly SameSite=Lax cookies with Secure when HTTPS. For LAN HTTP demos, clearly document transport risk and use only throwaway accounts.
- Rate limits on auth, invite redemption and message creation (local in-process sufficient for single-node demo); validation max sizes for all inputs.
- Cursor pagination uses `(channel_id, sequence)` index to avoid offsets and races.
- Search: FTS5 when available, with a documented fallback indexed query (still permission-filtered). Use SQLite migrations and test FTS availability.
- Strict contract types, no `any` in API boundaries, errors carry `code` and `message` (never internal SQL).

## Repository layout after implementation
```
apps/web/src/{app,components,features,styles}
apps/server/src/{db,auth,domains,http,realtime,config}
packages/contracts/src
scripts/
tests/e2e/
.local-data/ (ignored)
```

## Day-zero bootstrap
Story P0-01 creates package.json workspace scripts and tsconfig; this archive intentionally does not pretend those files already exist. Story P0-02 establishes executable CI-style quality commands, then dependencies can be installed and the build proceeds phase by phase.
