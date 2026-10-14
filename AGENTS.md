# Mandatory agent contract — SIDEBAND

## Your mission
Create a complete, original **local-first community communication product**, built from scratch from this empty repository. No prebuilt clone repository, no copying commercial site layouts/assets/branding, no HTML-only mockup, no fake data wired only in frontend, no hardcoded success responses. The product must look authored and work with real backend state.

**Follow `tasks.json` in order. Implement exactly one assigned story per iteration.** Do not skip dependencies, start optional features early, or rewrite the plan to make completion easier. Preserve evidence and write real test output in `progress.md`. Do not mark tasks complete yourself: `scripts/loop.py verify` runs checks and owns statuses. Read `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/LOCAL_API.md`, `docs/SCHEMA.md`, `docs/SECURITY.md`, `design/VISUAL_DIRECTION.md`, and `docs/TEST_PLAN.md` before implementation. Those files are the product contract.

## Non-negotiable constraints
- Runtime uses localhost-only resources. No Stripe, Supabase, Firebase, Clerk, Auth0, Discord bot, Discord API, cloud DB, S3, Cloudinary, external image URLs, Google Fonts, telemetry, externally loaded scripts, hosted LLM APIs, or paid infrastructure.
- Local app architecture: npm workspaces; TypeScript; Vite + React; Node.js + Fastify; Socket.IO; SQLite via better-sqlite3; Zod validation; Vitest; Playwright browser tests. Versions should be current and compatible at install time. Pin them in lockfile; no unbounded `latest` in deliverable.
- App name SIDEBAND. Original interface with own shape, spacing, type scale, icons, colors and layouts. Discord is a category reference, not an asset/style template.
- Server owns authentication, permissions, validation, data, canonical message ordering, rate limiting, and WebSocket admission. The client never decides authorization. DB is SQLite in `.local-data/` ignored by Git.
- Default listener `127.0.0.1`. LAN share only with `DEMO_LAN=1` and explicit documented consent; no port forwarding, reverse tunnels or public sharing.
- Use own original SVG icons or an installed icon package; assets must be locally bundled and appropriately licensed.
- Never implement fake live functionality, placeholder buttons for 'completed' stories, cosmetic unread badges without backend state, localStorage-as-database, or in-memory-only chat.
- No scraping other people's personal messages, credentials, tokens, or private web interactions. Optional REA observation is passive and only on explicitly authorized targets. See `docs/REA_RESEARCH_PROTOCOL.md`.
- UI: keyboard navigation, visible focus, empty/error/loading states, responsiveness (1440, 1024, 768, 390 and 320 widths). Avoid generic SaaS card grids, random neon, glows, glass blur, purple gradients, fake terminal decoration, identical columns of rounded rectangles, decorative meaningless charts.

## Engineering process
1. Read assigned task with its acceptance criteria. Run or inspect current test baseline first.
2. Implement the minimal complete vertical slice to pass this task; no uncontrolled refactors. Validate role and failure paths, not just happy path.
3. Add/modify automated tests appropriate to the task; run its `checks`. Never write tests that always pass or stub a backend contract while claiming implemented behavior.
4. Run available `npm run typecheck`, `npm run lint`, `npm run test`, and task-specific checks once scripts exist. Log executed commands and concise outcomes in progress.md (do not include keys or sensitive data).
5. If blocked, record exact error and hypothesis; do not claim success or modify task acceptance. The next loop repairs current task first.
6. Stop at phase gate. Visual and security gates require review rather than auto sign-off. Use `python scripts/loop.py approve --phase P1 --note '...evidence...'` only after **human** review; never execute this command as an agent.

## Success gate
A story is not done merely because it rendered once. It is done if machine checks pass **and** the agent has checked the acceptance details. A phase is not complete until the human has reviewed its milestone. Final verification requires multi-client real-time state, offline run, role permissions, persistence after process restart, and visual screenshots across target sizes. Any missing test is an explicit limitation.

## Communication style
Use concise engineering logs: changed files, implemented behavior, command results, blockers. Never claim the Discord service was cloned or its private backend inspected. We're building an independently implemented product, not recovering proprietary source.
