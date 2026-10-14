# SIDEBAND Demo & Local Operations Runbook

## Overview

SIDEBAND is an original, local-first community communication application built with:
- **Frontend:** React 18, TypeScript, Vite, TanStack Query, custom CSS design token system
- **Backend:** Node.js, Fastify 5, Socket.IO 4, Zod validation
- **Database:** SQLite (`better-sqlite3`) in WAL mode with foreign keys and FTS5 search
- **Zero Cloud Dependencies:** Runs 100% on `127.0.0.1` without external APIs, CDNs, or remote fonts.

---

## 1. Clean Setup & Database Migration

From the repository root (`SIDEBAND_Loop_Engineering_Kit`):

```powershell
# 1. Install workspace dependencies
npm install

# 2. Run idempotent SQLite migrations (.local-data/sideband.sqlite)
npm run db:migrate

# 3. Seed demo workspace, channels, and two demo accounts
npm run seed:demo
```

### Demo Accounts Created by `npm run seed:demo`
- **Owner Account:** `alice` (Display Name: `Alice Vance`, Role: `owner`)
- **Member Account:** `bob` (Display Name: `Bob Mercer`, Role: `member`)
- **Password:** Printed once to stdout when running `npm run seed:demo` (or override via `SEED_PASSWORD` environment variable; never committed to source).
- **Seeded Space:** `SIDEBAND Signal Lab`
  - `#general` (public channel)
  - `#build-log` (public channel)
  - `#core-security` (private channel — accessible to `alice`, restricted from `bob` unless granted)

---

## 2. Running in Local Development Mode (Loopback Default)

```powershell
npm run dev
```
- **Fastify API + Socket.IO Server:** `http://127.0.0.1:3001`
- **Vite Web Dev Server:** `http://127.0.0.1:5173` (proxies `/api/v1` and `/socket.io` to `127.0.0.1:3001`)

---

## 3. Running in Production Single-Server Mode

```powershell
npm run build
npm run start
```
- Builds `@sideband/contracts`, `@sideband/server`, and `@sideband/web`.
- Serves the compiled SPA and API/Socket.IO from a single origin on `http://127.0.0.1:3001`.
- Operates completely offline (with Wi-Fi/WAN disconnected).

---

## 4. Safe Database Reset (`npm run db:reset`)

To wipe `.local-data/sideband.sqlite` and uploaded attachments and re-initialize a clean schema:

```powershell
npm run db:reset -- --confirm
```
- Refuses to delete paths outside the repository `.local-data` directory.
- Requires explicit confirmation (`--confirm` or interactive `yes` prompt).

---

## 5. Opt-In Same-Wi-Fi LAN Demo Mode (`DEMO_LAN=1`)

By default, SIDEBAND binds strictly to `127.0.0.1` (loopback). To demonstrate real-time multi-device interaction with another participant on the same trusted local Wi-Fi network:

```powershell
npm run build
$env:DEMO_LAN="1"
$env:CORS_ORIGIN="http://<YOUR_LAN_IP>:3001"
npm run start
```

### Security & Firewall Limits for LAN Mode
1. **Explicit Opt-In Only:** Setting `DEMO_LAN=1` binds Fastify to `0.0.0.0:3001` and logs a security warning on startup.
2. **Throwaway Credentials Only:** Plain HTTP over local Wi-Fi does not encrypt traffic in transit. Only use throwaway demonstration accounts on a trusted private network.
3. **Firewall / Isolation:** Ensure Windows Defender Firewall (or macOS/Linux firewall) permits inbound TCP port `3001` on the Private network profile, and that Wi-Fi client isolation is disabled on the router.
4. **No Tunnels:** Never expose `DEMO_LAN=1` through reverse tunnels, port forwarding, or public internet proxies. Unset `DEMO_LAN` immediately after completing the demonstration.
