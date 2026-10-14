# SIDEBAND Quality, Offline, Performance & Durability Report (`docs/QUALITY_REPORT.md`)

## 1. Offline & Local-Only Network Verification

- **Static Source Audit (`python scripts/network_audit.py`):**
  - Scanned all `.ts`, `.tsx`, `.js`, `.jsx`, `.css`, `.html`, `.json`, `.mjs` files across `apps/` and `packages/`.
  - Result: `Static URL audit: no non-local URL literals found.` (Exit code `0`).
- **Runtime Browser Network Inspection (`tests/e2e/durability.spec.ts`):**
  - Attached Playwright `page.on('request')` listener across registration, space creation, channel creation, 505 message insertions, timeline rendering, and page reload.
  - Asserted zero requests outside `127.0.0.1` / `localhost`.
  - Result: `externalRequests` array length `0` (PASSED).

---

## 2. High-Volume Message Timeline & SQLite Performance (500+ Messages)

- **Scenario (`tests/e2e/durability.spec.ts`):**
  - Seeded **505 messages** into `#stress-test` with transactional per-channel `sequence` increments (`1..505`) and unique `client_nonce` values.
  - Loaded channel in Chromium and verified cursor pagination, rendering of latest messages (`Benchmark message #505`), and full state preservation across page reload.
  - Execution time for 505-message E2E test including browser render and reload: **1.2s**.
- **Database Configuration (`apps/server/src/db/index.ts` & `001_init.sql`):**
  - `PRAGMA journal_mode = WAL`
  - `PRAGMA foreign_keys = ON`
  - `PRAGMA busy_timeout = 5000`
  - `PRAGMA synchronous = NORMAL`
  - Indexed lookups: `idx_messages_channel_seq ON messages(channel_id, sequence)`, `UNIQUE(channel_id, sequence)`, `UNIQUE(channel_id, author_id, client_nonce)`, `idx_sessions_token`, `idx_channels_space`, `idx_space_members_user`, `idx_channel_members_user`, `idx_invites_space`, `idx_attachments_message`, `idx_audit_space`, plus `messages_fts` (FTS5 virtual table with triggers and parameterized `LIKE` fallback).

---

## 3. Automated Test Matrix Summary

- **Typecheck (`npm run typecheck`):** Passed across `@sideband/contracts`, `@sideband/server`, and `@sideband/web` (0 errors).
- **Lint (`npm run lint`):** Passed with `--max-warnings=0` (0 errors, 0 warnings).
- **Integration & Security Suite (`npm run test`):**
  - `tests/integration/core.test.ts`: **17 passed** (schemas, idempotent migrations, auth lifecycle, transactional message sequencing, clientNonce idempotency, cursor pagination, edit/soft-delete tombstones, SHA-256 invite token storage, FTS/LIKE search, persisted read cursors).
  - `tests/integration/security.test.ts`: **13 passed** (private channel multi-surface isolation across HTTP read/write, search, attachments, and Socket.IO rooms; live room ejection on access revocation; cross-space isolation; owner protection; MIME/size/path-traversal upload defenses; CSRF Origin verification; SQL/FTS metacharacter safety).
- **Playwright Browser E2E Suite (`npm run test:e2e`):**
  - `tests/e2e/chat.spec.ts`: **Passed** (two independent browser contexts, live Socket.IO delivery without refresh, edit/delete propagation, private channel denial, responsive screenshots at 1440/1024/768/390/320).
  - `tests/e2e/accessibility.spec.ts`: **Passed** (keyboard navigation, focus visibility, unblocked composer and keyboard send at 320×720).
  - `tests/e2e/durability.spec.ts`: **Passed** (505 messages, reload persistence, zero external network calls).
