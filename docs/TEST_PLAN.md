# Verification matrix and hard gates

## Tests must prove server-backed behavior
Do not substitute mocked HTTP requests for the main end-to-end suite. Unit tests can mock dependencies as appropriate, but integration and browser tests must use Fastify + temporary SQLite DB + Socket.IO.

| ID | Scenario | Required proof |
|---|---|---|
| E2E-01 | Fresh setup -> register owner | Account persists in SQLite; cookie session works after refresh |
| E2E-02 | Create space and two channels | Reload shows both channels, correct ordering |
| E2E-03 | Second browser signs up and joins invite | Different account, joined space, membership persisted |
| E2E-04 | Send A -> B in real time | B sees message without refresh; duplicate clientNonce creates exactly one row |
| E2E-05 | Disconnect/reconnect B | All missed messages retrieved in correct sequence |
| E2E-06 | Edit and delete | Both clients update; soft-delete prevents old text rendering |
| E2E-07 | Role restriction / private channel | A can access; B rejected from HTTP read, search and WebSocket room |
| E2E-08 | Restart backend | Message history, invites and memberships survive restart |
| E2E-09 | Search | Only accessible messages; search result navigates to actual message |
| E2E-10 | Read cursor | Unread counts update across refresh and user contexts |
| E2E-11 | Sessions | Logout invalidates session; expired token rejected |
| E2E-12 | Input abuse | XSS inert, large payload rejected, SQL metacharacters safe, rate limits active |
| E2E-13 | LAN demo | Only opt-in LAN binding; two actual devices on same network succeed |
| E2E-14 | Offline | Disconnect WAN; registration, chat, search, settings still work without external calls |
| E2E-15 | Visual | Screenshot evidence at 1440, 1024, 768, 390, 320; no overflow or missing affordances |
| E2E-16 | Accessibility | Keyboard complete auth/channel/send flow; labelled controls; focus visible |

## Test layers
1. Contract unit tests: Zod schemas, permissions matrix, invite token logic, message sequencing, nonce idempotency.
2. Server integration: temp SQLite DB and Fastify injection, SQLite migrations, negative auth, search visibility and WebSocket scope.
3. Two-browser Playwright: separate `browser.newContext()` instances; real app/server process; no request mocks. Prefer chromium binary installed locally beforehand.
4. Runtime smoke: `npm run build`, start production server, health check, use two browser tabs with different users.
5. Visual review: manually inspect stored screenshots; machine screenshot generation does not equal visual signoff.

## Required `npm` commands
- `npm run typecheck` must typecheck all workspaces.
- `npm run lint` must fail on serious errors.
- `npm run test` must execute unit+integration tests.
- `npm run test:e2e` must execute real Playwright browser scenarios.
- `npm run verify:all` chains typecheck, lint, test, build, e2e with nonzero exit on any failure.
- `npm run db:migrate`, `npm run seed:demo`, `npm run dev`, `npm run start` must all be real commands.

## Automated status is not creative signoff
The loop's command checks can verify build artifacts and test command exit status. They cannot establish full visual quality or legal publication. Human-review gates P1 (visual), P3 (realtime/access), and P5 (release) are mandatory. Never self-approve on behalf of the owner.

## Evidence to retain
`evidence/test-results/` (ignored as needed): timestamped command outputs, browser screenshots for key states, two-user video capture optional, build stats, list of vulnerabilities not yet fixed. Report exact test status; no fabricated results.
