# REA protocol: optional, bounded research input

## Verified ability, crucial limitation
REA (`morluto/rea`, npm package `rea-agents`) connects an agent to tools for **passive Chrome DevTools Protocol observation** and for **local Electron/JavaScript artifact inspection**. It may inspect DOM/accessibility structure, script resource graphs, attach-window network metadata, and bounded WebSocket shape metadata. REA does **not** disclose Discord's server-side code and does **not** automatically make a functional clone. The browser provider is *not* a general automation/clicking API.

## Constraint reconciliation
Strictly offline runtime means do NOT navigate to discord.com or perform live internet reconnaissance during this app build. If users independently approve an online research session, keep it separate, record only safe, lawful, non-sensitive generalized UI interaction observations and disconnect before running the app. Never let the agent automatically scrape Discord accounts.

## If you have a permitted local target
- Setup `npx rea-agents@latest setup` when deps can be installed; check `rea doctor` and current CLI help.
- For a **locally hosted test page in a dedicated Chrome profile**, open Chrome with `--remote-debugging-port=9222` and approved loopback CDP endpoint; explicitly configure REA browser access to `127.0.0.1` and the exact allowed local origin, as documented by your installed REA version. Be aware this opens sensitive debugging access on the host; bind only to loopback.
- CLI operations include `rea list-browser-targets`, `rea inspect-web-page`, `rea capture-web-screenshot`, and `rea analyze-web-bundle`. Use the exact installed schemas and approval flags. They observe, not control, the page.
- For software you own and have authorized to inspect, `rea analyze-javascript-application /absolute/path/to/app --json` analyzes a local Electron directory/ASAR without executing the app.
- Log observations with target, source, time, permission, evidence status and uncertainty. Strip all personal messages, tokens, IDs, cookies and private assets from any publication.

## REA-inspired research questions
- How is a channel list composed and filtered under scrolling/loading?
- What UI state is visible on disconnect/reconnect?
- Which features are stateful on server vs transient on client? **Do not infer backend implementation from frontend activity**.
- How does focus, shortcut navigation and empty state behavior work?
- How are real-time events represented *at the observable interface*?

## Original product requirement
Build SIDEBAND using our documented contracts. REA evidence is reference data, not a code dependency or claim of correctness. Do not block implementation because Discord or any other proprietary site is unavailable.

Source of tool contract: https://github.com/morluto/rea/blob/main/docs/browser-observation.md and https://github.com/morluto/rea/blob/main/README.md
