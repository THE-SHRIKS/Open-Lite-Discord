# Demo, open-source and OpenDeck handoff

## Demo checklist
- Run complete tests. Ensure `npm run build` and `npm run start` load the production build from SQLite with network disconnected.
- Show two separate browser contexts/accounts in side-by-side windows. Send, edit, delete, invite, switch channels, test role denial, restart server and show preserved history.
- Performance: scrolling smooth with seeded 500+ messages, no leaked observers or runaway client rerenders, no double messages after reconnect.
- Use fresh demonstration credentials. Delete old accounts/attachments and wipe private data before sharing a demo machine.
- Review offline Chrome Network; only 127.0.0.1 traffic in solo mode.

## Optional same-Wi-Fi share
The demo server defaults to loopback only. **Only explicitly in demo mode** (`DEMO_LAN=1`) bind the production Fastify process to `0.0.0.0`; set `PUBLIC_ORIGIN=http://LAN_IP:3001` as appropriate and allow exact same-origin WebSockets. Access `http://LAN_IP:3001` from the other device. Review local firewall rules and disable guest/isolated Wi-Fi restrictions; remove the flag afterward. This is not public internet deployment, and plaintext LAN HTTP is **not** suitable for real passwords or private conversations.

## Public GitHub release
- LICENSE: choose MIT for original code, after checking dependencies' licenses.
- README: honest feature list, local install, supported platforms, no backend service, no production security assurance, screenshots captured from working app.
- Include DB migrations; exclude `.local-data`, seed secrets, `.env`, user uploads, model caches, other programs' decompiled material, and REA captures with private content.
- Source is independently implemented; no Discord icons, logos, fonts, sound effects, copied layouts or protected code.
- Add repository URL and install steps to OpenDeck when the user separately authorizes publishing. Website `opendeck.theshriks.space` is a resource destination, not a part of app runtime.

## Reel accuracy checklist
Only after successful recorded testing: state accurately that REA was used if it actually was; indicate whether observed source was browser UI or authorized local binary; distinguish AI-assisted implementation from recovered Discord backend; show what exists and what doesn't. Do not imply entire Discord was rebuilt.
