# SQLite schema contract

Use migrations, foreign keys `PRAGMA foreign_keys=ON`, WAL mode, busy timeout and transactions. Provide indexes for all foreign keys and frequent lookup fields. No externally hosted database.

| Entity | Core columns and constraints |
|---|---|
| `users` | id UUID PK, username unique casefolded, display_name, password_hash, avatar_color, created_at |
| `sessions` | id, user_id, token_sha256 unique, expires_at, revoked_at, created_at; no raw tokens |
| `spaces` | id, name, slug scoped unique as needed, owner_id, created_at, icon_text |
| `space_members` | (space_id,user_id) PK, role `owner/admin/member`, joined_at |
| `channels` | id, space_id, name, topic, visibility `public/private`, channel_order, last_sequence, archived_at |
| `channel_members` | (channel_id,user_id) PK for explicit private channel grants |
| `messages` | id, channel_id, author_id, body, sequence, client_nonce, edited_at, deleted_at, created_at; UNIQUE(channel_id,sequence); UNIQUE(channel_id,author_id,client_nonce) |
| `invites` | id, space_id, token_sha256, issued_by, expires_at, uses_remaining, revoked_at |
| `read_cursors` | (user_id,channel_id) PK, last_read_sequence, updated_at |
| `attachments` | id, message_id, storage_key, original_filename, mime, byte_length, created_at |
| `audit_events` | id, space_id, actor_id, action, target_id, metadata_json, created_at |

Use SHA-256 of high-entropy random invite/session tokens, not plaintext. Attachment retrieval must validate message/channel authorization. Deletion of messages should be soft by default, leaving a tombstone. Deletion/moderation events must be broadcast in realtime and reflected by refetching.

## Demo seed
Script creates an owner, guest, one space, three channels and 15 original messages, with credentials from dev-only environment or printed one-time setup notes; do not commit passwords into source. The seed is idempotent and only permitted when `NODE_ENV != production` or `DEMO_SEED=1` is explicitly set. Include `db:reset` that requires interactive confirmation and refuses deletion of arbitrary paths.
