# Human phase sign-off checklist

P0: npm workspaces actually initialize, typecheck/lint/test work, migrations write SQLite, auth cookies and routes are real.

P1: At 1440×900, 1024×768, 768×1024, 390×844 and 320×720, the UI looks authored and functional. Long chats work, no empty fake panels, keyboard focus and empty/error states are legible. Add screenshots and note where viewed.

P2: A second account joins through an invite, roles are enforced at server, messages edit/delete/search, files cannot be read by unauthorized user.

P3: In TWO independent browser contexts, messaging appears live; disabling network/restarting server then reconnecting recovers messages; unauthorized WebSocket room subscribe rejected.

P4: Run real unit, integration and Playwright tests with a temporary DB. Explicitly record failure and fix. Disconnect Internet and observe all app requests are local. Review memory/performance with substantial history.

P5: On another device on same LAN, deliberate opt-in allows locally hosted demo with throwaway accounts. Check source/license/secrets before GitHub/OpenDeck release. Do NOT approve publishing without user's explicit authorization.
