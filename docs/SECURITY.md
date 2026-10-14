# Security, consent, local-first and release

## Trust model
- No third-party auth provider. Credentials stay on local machine and in an encrypted/transient browser connection only where transport supports it; HTTPS is preferable when exposing LAN, and use throwaway demo credentials for plain HTTP LAN.
- The local app must operate with Wi-Fi disabled after installation. A LAN demo necessarily uses local network access, not the public Internet.
- Do not call external APIs or bundle CDN scripts. Avoid remote fonts/images and analytics beacons. Browser DevTools Network must show local origin only.
- Avoid secrets in Git: `.env`, `.local-data/`, `uploads/`, logs, screenshot artifacts, REA reports capturing user content. Supply `.env.example` only.

## Auth and authorization
- Hash passwords with per-user scrypt salt and appropriate cost parameters. Reject short passwords. Sessions: cryptographically random high-entropy token; hashed token in DB; HttpOnly SameSite cookie; session revocation on logout.
- Check Origin on credentialed mutations and WebSockets. In local non-TLS mode, cookies cannot carry Secure flag; document tradeoff.
- All route handlers and Socket.IO subscriptions call a centralized permission service; no ad-hoc client-side role decisions.
- Private channel data MUST be inaccessible through search, guessed URLs, stored files, and realtime broadcasts.
- Validate text lengths, reject HTML injection, render chat as escaped text by default, clamp file paths; upload limits and allowlist MIME/content sniffing.
- Rate limit login, invite, message send, typing. Add simple logs with privacy-minimal redaction.

## Responsible research boundary
- Reverse engineering is not automatically legal merely because content is free or open-source. Do not bypass access protections, capture other people's messages/tokens, or copy Discord's logos/assets/proprietary code. Use REA only on authorized material. The finished product is an independent implementation of general communication concepts.
- The REA browser provider is passive; it is not an automated site cloner. The reference stage is optional and can be skipped without blocking the build.

## Public release preparation
- Run dependency license audit and secret scan; remove seed credentials and REA captures containing private data.
- The public repository can contain our *own source code and general research notes*, but no proprietary reverse-engineered assets or leaked app internals.
- Releasing to OpenDeck/public GitHub requires a separate human-authorized publish step. Do not auto-publish or assume an OpenDeck URL exists.
