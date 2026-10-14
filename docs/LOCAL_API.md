# Local HTTP + realtime API contract

All requests go to the **locally hosted backend**, never to remote provider APIs. Prefix `/api/v1`. JSON request/response, cookies for auth, CSRF protection for mutations (same-origin and origin verification at minimum). Version schema in `packages/contracts`.

| Method | Route | Semantics | Auth |
|---|---|---|---|
| POST | `/auth/register` | username, password -> account + session | no |
| POST | `/auth/login` | credentials -> session cookie | no |
| POST | `/auth/logout` | revoke session | yes |
| GET | `/auth/me` | current profile and memberships | yes |
| GET/POST | `/spaces` | list/create spaces | yes |
| GET/PATCH | `/spaces/:id` | details/edit space | member/owner |
| GET/POST | `/spaces/:id/channels` | channel list/create | member/admin |
| PATCH/DELETE | `/channels/:id` | change/archive channel | role |
| GET | `/channels/:id/messages?before=<sequence>&limit=50` | cursor pagination | channel reader |
| POST | `/channels/:id/messages` | create message with clientNonce | channel writer |
| PATCH/DELETE | `/messages/:id` | edit/delete own or moderation action | author/admin |
| GET | `/search?q=...&spaceId=...` | permission-filtered query | member |
| POST | `/spaces/:id/invites` | invite with expiry and usage cap | admin/owner |
| POST | `/invites/redeem` | join space from token | yes |
| GET/PATCH | `/spaces/:id/members` | list/update roles | member/admin |
| POST | `/channels/:id/read` | update persisted last-read sequence | reader |
| GET/POST | `/uploads` | authorized, size-limited local files | member |
| GET | `/health` | readiness; no sensitive info | local |

### Minimum response envelopes
Success: `{"data": {...}}`. Error: `{"error": {"code": "FORBIDDEN", "message": "Access denied"}}`; appropriate 4xx/5xx codes. Never expose passwords, session hashes, stack traces or raw SQL. Validate every query param and body.

### Socket.IO
Handshake authenticates same session cookie and enforces allowed Origin. Rooms are `space:<id>` and `channel:<id>` after server-side membership checks. Events emitted by server: `message:created`, `message:updated`, `message:deleted`, `channel:updated`, `membership:updated`, `typing:changed`, `presence:changed`. Client sends `channel:subscribe`, `channel:unsubscribe`, `typing:set`, each validated and rate-limited. Event payload includes server sequence, IDs and canonical timestamps. Client always fetches backlog after reconnect.

### HTTP/WS invariants
A user excluded from a private channel must not retrieve it via HTTP, search, pagination, direct attachment URL, or Socket.IO room subscription. This is a required automated negative test. Send-and-retry with same clientNonce must persist **one** message. Invalid or oversized inputs return typed errors, not unhandled exceptions.
