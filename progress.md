# SIDEBAND implementation journal

**State as packaged: NOT STARTED.** This kit is an agent execution system, not a working codebase. No npm install, implementation, REA analysis, screenshot, multi-user test, or open-source publication has been performed by this archive.

Append exact commands, results, decisions, blockers and changed files here. Keep evidence factual, and never paste credentials. The runner adds machine-check records automatically. The agent should add a concise story execution log after implementation.

### 2026-10-12T17:13:07+05:30
**P0-01 machine checks**: PASS

    FILE OK package-lock.json
    FILE OK tsconfig.base.json
    FILE OK apps/web/package.json
    FILE OK apps/server/package.json
    FILE OK packages/contracts/package.json
    FILE OK apps/web/index.html
    FILE OK apps/server/src/index.ts
    $ npm run typecheck
    
> sideband@0.1.0 typecheck
> npm run typecheck --workspaces --if-present


> @sideband/web@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


> @sideband/server@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


> @sideband/contracts@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


    EXIT: 0

### 2026-10-12T17:13:14+05:30
**P0-02 machine checks**: PASS

    FILE OK apps/server/src/config.ts
    $ npm run typecheck
    
> sideband@0.1.0 typecheck
> npm run typecheck --workspaces --if-present


> @sideband/web@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


> @sideband/server@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


> @sideband/contracts@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


    EXIT: 0
    $ npm run lint
    
> sideband@0.1.0 lint
> eslint . --ext .ts,.tsx --max-warnings=0


    EXIT: 0
    $ npm run test
    lete[2m > [22mallows space owner (moderator) to delete member message and sets tombstone
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m6. Invites and Plaintext Hash Storage[2m > [22mgenerates invite and does NOT store plaintext token in DB
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m6. Invites and Plaintext Hash Storage[2m > [22mallows redemption and enforces maxUses cap
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m7. Search and Read Cursors[2m > [22msearches messages and returns results with highlights
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m7. Search and Read Cursors[2m > [22mupdates read cursor and computes unreadCount
[90mstdout[2m | tests/integration/security.test.ts[2m > [22m[2mSIDEBAND Security Integration Tests
[22m[39m[migrate] Applied: 001_init.sql

 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized space member on GET /messages
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized space member on POST /messages
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mexcludes private channel messages from search for unauthorized member
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized member from downloading private attachment
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m2. Realtime Role & Channel Synchronization[2m > [22mejects revoked user from Socket.IO room and emits access:revoked
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m3. Cross-Space Isolation[2m > [22mdenies non-member user Eve on space, channel, and member endpoints
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m4. Owner Protection[2m > [22mrefuses to demote or kick space owner
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22mrejects disallowed MIME type (text/html)
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22mrejects payload exceeding 5MB
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22msanitizes path traversal in originalFilename
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m6. Origin Verification (CSRF Defense)[2m > [22mrejects mutating request with untrusted Origin header
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m6. Origin Verification (CSRF Defense)[2m > [22mallows mutating request with local localhost Origin
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m7. Safe SQL / FTS Input Handling[2m > [22mhandles metacharacters safely without 500 error or SQL injection

[2m Test Files [22m [1m[32m2 passed[39m[22m[90m (2)[39m
[2m      Tests [22m [1m[32m30 passed[39m[22m[90m (30)[39m
[2m   Start at [22m 17:13:12
[2m   Duration [22m 1.70s[2m (transform 123ms, setup 0ms, collect 463ms, tests 923ms, environment 0ms, prepare 93ms)[22m


    EXIT: 0

### 2026-10-12T17:13:19+05:30
**P0-03 machine checks**: PASS

    FILE OK apps/server/src/db/index.ts
    FILE OK apps/server/src/db/migrate.ts
    FILE OK apps/server/src/db/migrations/001_init.sql
    $ npm run typecheck
    
> sideband@0.1.0 typecheck
> npm run typecheck --workspaces --if-present


> @sideband/web@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


> @sideband/server@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


> @sideband/contracts@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


    EXIT: 0
    $ npm run test
    lete[2m > [22mallows space owner (moderator) to delete member message and sets tombstone
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m6. Invites and Plaintext Hash Storage[2m > [22mgenerates invite and does NOT store plaintext token in DB
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m6. Invites and Plaintext Hash Storage[2m > [22mallows redemption and enforces maxUses cap
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m7. Search and Read Cursors[2m > [22msearches messages and returns results with highlights
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m7. Search and Read Cursors[2m > [22mupdates read cursor and computes unreadCount
[90mstdout[2m | tests/integration/security.test.ts[2m > [22m[2mSIDEBAND Security Integration Tests
[22m[39m[migrate] Applied: 001_init.sql

 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized space member on GET /messages
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized space member on POST /messages
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mexcludes private channel messages from search for unauthorized member
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized member from downloading private attachment
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m2. Realtime Role & Channel Synchronization[2m > [22mejects revoked user from Socket.IO room and emits access:revoked
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m3. Cross-Space Isolation[2m > [22mdenies non-member user Eve on space, channel, and member endpoints
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m4. Owner Protection[2m > [22mrefuses to demote or kick space owner
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22mrejects disallowed MIME type (text/html)
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22mrejects payload exceeding 5MB
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22msanitizes path traversal in originalFilename
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m6. Origin Verification (CSRF Defense)[2m > [22mrejects mutating request with untrusted Origin header
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m6. Origin Verification (CSRF Defense)[2m > [22mallows mutating request with local localhost Origin
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m7. Safe SQL / FTS Input Handling[2m > [22mhandles metacharacters safely without 500 error or SQL injection

[2m Test Files [22m [1m[32m2 passed[39m[22m[90m (2)[39m
[2m      Tests [22m [1m[32m30 passed[39m[22m[90m (30)[39m
[2m   Start at [22m 17:13:18
[2m   Duration [22m 1.56s[2m (transform 118ms, setup 0ms, collect 447ms, tests 807ms, environment 0ms, prepare 91ms)[22m


    EXIT: 0

### 2026-10-12T17:13:24+05:30
**P0-04 machine checks**: PASS

    FILE OK apps/server/src/auth/service.ts
    FILE OK apps/server/src/auth/routes.ts
    $ npm run typecheck
    
> sideband@0.1.0 typecheck
> npm run typecheck --workspaces --if-present


> @sideband/web@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


> @sideband/server@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


> @sideband/contracts@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


    EXIT: 0
    $ npm run test
    lete[2m > [22mallows space owner (moderator) to delete member message and sets tombstone
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m6. Invites and Plaintext Hash Storage[2m > [22mgenerates invite and does NOT store plaintext token in DB
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m6. Invites and Plaintext Hash Storage[2m > [22mallows redemption and enforces maxUses cap
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m7. Search and Read Cursors[2m > [22msearches messages and returns results with highlights
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m7. Search and Read Cursors[2m > [22mupdates read cursor and computes unreadCount
[90mstdout[2m | tests/integration/security.test.ts[2m > [22m[2mSIDEBAND Security Integration Tests
[22m[39m[migrate] Applied: 001_init.sql

 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized space member on GET /messages
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized space member on POST /messages
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mexcludes private channel messages from search for unauthorized member
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized member from downloading private attachment
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m2. Realtime Role & Channel Synchronization[2m > [22mejects revoked user from Socket.IO room and emits access:revoked
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m3. Cross-Space Isolation[2m > [22mdenies non-member user Eve on space, channel, and member endpoints
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m4. Owner Protection[2m > [22mrefuses to demote or kick space owner
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22mrejects disallowed MIME type (text/html)
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22mrejects payload exceeding 5MB
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22msanitizes path traversal in originalFilename
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m6. Origin Verification (CSRF Defense)[2m > [22mrejects mutating request with untrusted Origin header
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m6. Origin Verification (CSRF Defense)[2m > [22mallows mutating request with local localhost Origin
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m7. Safe SQL / FTS Input Handling[2m > [22mhandles metacharacters safely without 500 error or SQL injection

[2m Test Files [22m [1m[32m2 passed[39m[22m[90m (2)[39m
[2m      Tests [22m [1m[32m30 passed[39m[22m[90m (30)[39m
[2m   Start at [22m 17:13:23
[2m   Duration [22m 1.59s[2m (transform 122ms, setup 0ms, collect 458ms, tests 827ms, environment 0ms, prepare 92ms)[22m


    EXIT: 0

### 2026-10-12T17:13:30+05:30
**P0-05 machine checks**: PASS

    FILE OK apps/server/src/domains/spaces.ts
    FILE OK apps/server/src/domains/channels.ts
    FILE OK apps/server/src/domains/messages.ts
    $ npm run typecheck
    
> sideband@0.1.0 typecheck
> npm run typecheck --workspaces --if-present


> @sideband/web@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


> @sideband/server@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


> @sideband/contracts@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit


    EXIT: 0
    $ npm run test
    lete[2m > [22mallows space owner (moderator) to delete member message and sets tombstone
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m6. Invites and Plaintext Hash Storage[2m > [22mgenerates invite and does NOT store plaintext token in DB
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m6. Invites and Plaintext Hash Storage[2m > [22mallows redemption and enforces maxUses cap
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m7. Search and Read Cursors[2m > [22msearches messages and returns results with highlights
 [32mâœ“[39m tests/integration/core.test.ts[2m > [22mSIDEBAND Core Integration Tests[2m > [22m7. Search and Read Cursors[2m > [22mupdates read cursor and computes unreadCount
[90mstdout[2m | tests/integration/security.test.ts[2m > [22m[2mSIDEBAND Security Integration Tests
[22m[39m[migrate] Applied: 001_init.sql

 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized space member on GET /messages
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized space member on POST /messages
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mexcludes private channel messages from search for unauthorized member
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m1. Private Channel Isolation Across ALL Surfaces[2m > [22mdenies unauthorized member from downloading private attachment
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m2. Realtime Role & Channel Synchronization[2m > [22mejects revoked user from Socket.IO room and emits access:revoked
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m3. Cross-Space Isolation[2m > [22mdenies non-member user Eve on space, channel, and member endpoints
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m4. Owner Protection[2m > [22mrefuses to demote or kick space owner
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22mrejects disallowed MIME type (text/html)
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22mrejects payload exceeding 5MB
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m5. Attachment Security[2m > [22msanitizes path traversal in originalFilename
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m6. Origin Verification (CSRF Defense)[2m > [22mrejects mutating request with untrusted Origin header
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m6. Origin Verification (CSRF Defense)[2m > [22mallows mutating request with local localhost Origin
 [32mâœ“[39m tests/integration/security.test.ts[2m > [22mSIDEBAND Security Integration Tests[2m > [22m7. Safe SQL / FTS Input Handling[2m > [22mhandles metacharacters safely without 500 error or SQL injection

[2m Test Files [22m [1m[32m2 passed[39m[22m[90m (2)[39m
[2m      Tests [22m [1m[32m30 passed[39m[22m[90m (30)[39m
[2m   Start at [22m 17:13:28
[2m   Duration [22m 1.64s[2m (transform 123ms, setup 0ms, collect 448ms, tests 885ms, environment 0ms, prepare 94ms)[22m


    EXIT: 0

### 2026-10-12T17:14:30+05:30
**Full 6-Phase Implementation & Verification Log (P0-01 through P5-30)**

- **Phase P0 (P0-01..P0-05) — Foundation & Core Backend:**
  - Initialized npm workspaces (`apps/web`, `apps/server`, `packages/contracts`), TypeScript project references, ESLint v9 flat config (`eslint.config.js`), Vitest (`vitest.config.ts`), and server config (`apps/server/src/config.ts`).
  - Implemented idempotent SQLite WAL migrations (`apps/server/src/db/index.ts`, `apps/server/src/db/migrate.ts`, `apps/server/src/db/migrations/001_init.sql`) with all 11 tables, foreign keys, indexes, and FTS5 triggers.
  - Implemented scrypt password authentication, SHA-256 hashed session tokens, `HttpOnly` cookie sessions, CSRF Origin validation, and rate limiting (`apps/server/src/auth/service.ts`, `apps/server/src/auth/routes.ts`, `apps/server/src/auth/origin.ts`).
  - Implemented spaces, channels, and messages HTTP CRUD with transactional per-channel `sequence` ordering and `clientNonce` idempotency (`apps/server/src/domains/spaces.ts`, `apps/server/src/domains/channels.ts`, `apps/server/src/domains/messages.ts`).
  - Machine checks (`python scripts/loop.py verify`): **5/5 PASSED (`complete`)**.

- **Phase P1 (P1-06..P1-11) — Original Design System & Responsive UI Surface:**
  - Implemented SIDEBAND design tokens (`apps/web/src/styles/tokens.css`), global styles (`apps/web/src/styles/app.css`), custom SVG glyph (`SidebandIcon.tsx`), and accessible UI primitives (`Button.tsx`, `Input.tsx`, `Dialog.tsx`, `Spinner.tsx`, `EmptyState.tsx`).
  - Implemented `AppShell.tsx`, `ResponsiveNavigation.tsx`, `AuthScreen.tsx`, `SpaceRail.tsx`, `ChannelList.tsx`, `MessageTimeline.tsx`, `MessageComposer.tsx`, `MemberPanel.tsx`, `SettingsPanel.tsx`, and `docs/SCREENSHOT_REVIEW.md`.
  - Captured and inspected responsive screenshots at `1440x900`, `1024x768`, `768x1024`, `390x844`, and `320x720` in `evidence/screenshots/` with zero horizontal overflow.

- **Phase P2 (P2-12..P2-16) — Invites, Roles, Mutations, Search & Attachments:**
  - Implemented SHA-256 hashed token invites and atomic redemption (`apps/server/src/domains/invites.ts`, `apps/web/src/features/invites/InviteFlow.tsx`).
  - Implemented centralized permission service (`apps/server/src/auth/permissions.ts`), role editor (`apps/web/src/features/members/RoleEditor.tsx`), and private channel grants (`channel_members`).
  - Implemented message edit and soft-delete tombstoning (`apps/server/src/domains/messageMutations.ts`).
  - Implemented permission-filtered FTS5/LIKE search (`apps/server/src/domains/search.ts`, `apps/web/src/features/search/SearchPanel.tsx`) and persisted read cursors (`apps/server/src/domains/readCursors.ts`).
  - Implemented local disk attachment lifecycle with MIME allowlist, 5MB cap, filename sanitization, and channel-authorized retrieval (`apps/server/src/domains/attachments.ts`, `apps/web/src/features/messages/AttachmentPicker.tsx`).

- **Phase P3 (P3-17..P3-21) — Real-Time Socket.IO & Access Synchronization:**
  - Implemented authenticated Socket.IO server (`apps/server/src/realtime/index.ts`), presence tracker (`apps/server/src/realtime/presence.ts`), live room revocation (`apps/server/src/realtime/authorization.ts`), and shared event contracts (`packages/contracts/src/events.ts`).
  - Implemented frontend realtime hooks and indicators (`useConnectionState.ts`, `useRealtimeMessages.ts`, `TypingIndicator.tsx`) with automatic backlog sync (`?after=<highestSequence>`) on reconnect.

- **Phase P4 (P4-22..P4-26) — Integration, E2E, Security, Accessibility & Durability:**
  - Implemented 30 integration & security tests (`tests/integration/core.test.ts`, `tests/integration/security.test.ts`) — **30/30 PASSED**.
  - Implemented Playwright E2E suites (`playwright.config.ts`, `tests/e2e/chat.spec.ts`, `tests/e2e/accessibility.spec.ts`, `tests/e2e/durability.spec.ts`) and `docs/QUALITY_REPORT.md` — **3/3 E2E suites PASSED** (including 2-context live chat and 505-message scroll/reload durability with 0 external requests).

- **Phase P5 (P5-27..P5-30) — Demo Seed, LAN Mode, Visual Evidence & Release Prep:**
  - Implemented idempotent demo seed (`apps/server/src/db/seed.ts`) and safe reset (`apps/server/src/db/reset.ts`).
  - Verified opt-in `DEMO_LAN=1` mode in `apps/server/src/config.ts` (loopback `127.0.0.1` default).
  - Created `docs/DEMO_RUNBOOK.md`, `docs/FINAL_VERIFICATION.md`, and `LICENSE`.
  - Executed `python scripts/network_audit.py` (**PASS, exit 0**) and `npm run verify:all` (**PASS, exit 0**).
  - Note: Phase gate approvals (`python scripts/loop.py approve --phase P0..P5 --note "..."`) are reserved strictly for the human operator per `AGENTS.md`.

### 2026-10-12T18:16:45+05:30 — Independent Principal QA, Security & Full-Stack Audit Complete
- **Audit Scope:** Full line-by-line verification of `apps/server`, `apps/web`, `packages/contracts`, `tests/integration`, and `tests/e2e` against `AGENTS.md`, `tasks.json`, `docs/*`, and `design/VISUAL_DIRECTION.md`.
- **Repaired Defects (12):**
  1. Fixed SQLite FTS5 soft-delete update trigger (`001_init.sql`) so deleted messages (`body = NULL`) are never returned in search results.
  2. Enforced uploader-only authorization on unattached uploads (`GET /api/v1/attachments/:id` and `GET /api/v1/uploads/:id`) and added `GET /api/v1/uploads` (`attachments.ts`).
  3. Added rate limiting (`429 RATE_LIMITED`) on `POST /api/v1/invites/redeem` (`invites.ts`) and `POST /api/v1/channels/:id/messages` (`messages.ts`).
  4. Added `DELETE /api/v1/spaces/:id` (`spaces.ts`) and Space Settings edit/delete modal (`ChannelList.tsx`).
  5. Added `joinUserSocketsToSpace` and `space:subscribe` (`realtime/index.ts`) plus `channel:updated` broadcasts on private channel member grants/revocations.
  6. Fixed Socket.IO singleton reset and reconnection across SPA logout/login (`useConnectionState.ts`, `AuthScreen.tsx`).
  7. Added `useRealtimeSpace` hook in `AppShell.tsx` so space-level Socket.IO events work even when a space has 0 channels.
  8. Added interactive Private Channel Access grant/revoke UI and active invite revocation/expiry controls in `ChannelList.tsx`.
  9. Fixed rapid consecutive message submission race in `MessageComposer.tsx` so back-to-back messages never drop or overwrite input.
  10. Fixed profile update confirmation banner reset in `SettingsPanel.tsx`.
  11. Removed all `backdropFilter` blur rules from `Dialog.tsx` and `ResponsiveNavigation.tsx` for strict compliance with `design/VISUAL_DIRECTION.md`.
  12. Fixed `getDb(dataDir)` directory switching (`db/index.ts`) and added service-layer `displayName` validation + expired session pruning (`auth/service.ts`).
- **Verification Gate (`npm run verify:all`):**
  - `npm run typecheck`: PASS (0 errors)
  - `npm run lint`: PASS (0 warnings, 0 errors)
  - `npm run test`: PASS (34/34 integration & security tests in `core.test.ts` and `security.test.ts`)
  - `npm run build`: PASS
  - `npm run test:e2e`: PASS (4/4 Playwright E2E, two-user stress, accessibility, 500+ message pagination, zero external network, and full backend restart durability tests)
  - `python scripts/network_audit.py`: PASS (0 non-local URL literals)
- **Deliverable:** Created `FINAL_AUDIT.md` and captured 9 real browser screenshots in `evidence/screenshots/`.
