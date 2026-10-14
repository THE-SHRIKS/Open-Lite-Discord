# Phase order and human review

- **P0 · Foundation:** Monorepo/workspaces; executable checks; data migrations; auth/session base; same-origin local server.
- **P1 · Product surface:** Auth screens, original main shell, channel/message composer, profile/member interfaces, mobile states. Visual-review **mandatory**.
- **P2 · Durable product model:** Space/channel/membership/invite/message CRUD, roles, search and attachments, no fake endpoints.
- **P3 · Realtime:** WebSocket auth, two-client messaging, typing/presence, idempotency/reconnect and negative authorization. Human functionality review **mandatory**.
- **P4 · Integration & hardening:** Unit, server and browser tests, offline checks, performance, accessibility, error states.
- **P5 · Demo & publication-ready:** LAN opt-in, demo seed, record evidence, sanitize repo, final visual QA and release docs. Human approval **mandatory**.

After the last story in a phase, loop.py stops. An operator verifies evidence and runs `python scripts/loop.py approve --phase Pn --note "specific reviewed evidence"`. Approval is a progress journal entry, not proof of automatic correctness. The runner refuses approval with uncompleted tasks in that phase.

Completion: run `python scripts/loop.py status`; all tasks complete, all gates approved, `npm run verify:all` passes, and the human has reviewed screenshots & the offline/LAN demonstration. The agent must never approve itself.
