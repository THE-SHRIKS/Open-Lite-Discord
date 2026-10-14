# Product requirements / end-state

## Product concept
SIDEBAND is an original, desktop-first but responsive space for small technical communities. Workspaces called **spaces** contain channels, discussion history, participants, roles and invites. The design should feel like a refined communication instrument, not an imitation of Discord or a shiny AI-generated dashboard.

## Essential user journeys
1. Start a fresh instance with no accounts. First user registers and creates a space.
2. User A creates `#general` and `#build-log` channels; channels are stored in SQLite.
3. User A creates a time-limited invite link/token. User B registers in a separate browser and joins via local link.
4. A and B exchange text messages concurrently; incoming events appear without manual reload, correctly ordered.
5. One user refreshes, logs out/in, and restarts the server: data still exists.
6. Owner creates a private channel, gives B the appropriate role, and server authorization is tested with both allowed and denied actions.
7. User searches messages and jumps to context. Editors can edit/delete own messages and channels show update events.
8. Notifications/mentions, unread counters and typing/presence reflect server state, not static demo content.
9. User demonstrates the same instance to another person on same Wi-Fi, after intentionally enabling LAN mode.

## Required UI screens
- Welcome/registration and sign-in (intentional non-generic design)
- Main app shell: slim space switcher, channel nav, message stage, member/context sidebar
- Space creation and space switcher
- Channel creation, member management, roles and channel permissions
- Invite composer and invite redemption page
- Search panel with results and navigate-to-message
- Profile/preferences and keyboard shortcut help
- Proper placeholders for zero spaces/channels/messages, plus errors, loading/retry and disconnected state

## Required end-to-end behavior
- Email-as-local-identifier or unique username (no actual email delivery). Password registration/login/logout, secure session cookie, password hashing.
- Owner/admin/member roles; owner cannot be removed by others; server validates channel visibility and actions.
- Channels: create/edit/archive; channels belong to a space; membership affects visibility.
- Messages: CRUD, cursor pagination, per-channel sequences, timestamps, durable history, optional local attachments with type/size validation.
- Socket.IO: authenticated handshake, join/leave room, `message:created/edited/deleted`, `channel:changed`, `member:changed`, `typing`, presence, reconnect with missed-event sync.
- Search within accessible channels only; server performs filtering.
- Audit visible: minimal in-app action history on admin mutations, no plaintext secrets.
- Demo fixture (generated locally): two users, three channels, a few original seed messages. Clear reset instructions.

## Explicitly out of scope for first release
Voice/video, screen sharing, bots, push notifications, mobile app, federation, public Internet hosting, OAuth, third-party APIs, machine-learning personalization, Discord's source/artwork/sounds, or importing private Discord data. Voice is a stretch proposal after core acceptance, not a gate.

## Definition of product quality
- Responsive editorial interface that remains legible and stable under long names, large messages, empty channels and concurrent updates.
- All controls that appear actionable do something; do not ship inert buttons.
- Real backend, real DB, real permission checks; no localStorage-as-server.
- Measured tests, intentional error states, accessible keyboard flows.
- App opens without Internet after dependencies and test browser were installed beforehand.
