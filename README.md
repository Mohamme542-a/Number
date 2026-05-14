# IVASMS OTP → Telegram Bot

Full-stack scraper that logs into IVASMS via Playwright, monitors the inbox,
extracts OTPs, stores them in SQLite, pushes realtime updates to a React
dashboard, and forwards every new SMS to a Telegram bot.

> ⚠️ IVASMS has no public API. This project relies on browser automation,
> which may violate IVASMS Terms of Service. Use at your own risk.

## Project structure
```
backend/      Express + Socket.IO API
automation/   Playwright scraper (persistent Chromium session)
telegram/     node-telegram-bot-api integration (+ /latest command)
frontend/     React + Tailwind dashboard (dark mode, CSV export)
database/     SQLite schema
utils/        OTP extractor, AES-256-GCM crypto, logger
```

## Quick start (local)
```bash
cp .env.example .env        # fill in IVASMS + Telegram + secrets
npm install                 # also installs Chromium via Playwright
cd frontend && npm install && npm run build && cd ..
npm start                   # http://localhost:3000
```

## Telegram setup
1. Talk to @BotFather → /newbot → copy the token into `TELEGRAM_BOT_TOKEN`.
2. Send `/start` to your new bot. It replies with your chat id.
3. Put that chat id (comma-separated for multiple) in `TELEGRAM_CHAT_IDS`.
4. Use `/latest` or `/latest 10` in the bot to fetch recent messages.

## Docker
```bash
docker compose up -d --build
```

## PM2 (Ubuntu VPS)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

## Nginx reverse proxy
Copy `nginx.conf` to `/etc/nginx/sites-available/ivasms`, symlink, then
`certbot --nginx` for HTTPS.

## Adjusting selectors
If IVASMS changes their layout the row parser in
`automation/scraper.js → _scrapeRows()` is the only place to update.
Screenshots of failures are written to `screenshots/`.

## Security notes
- Credentials stored in `.env` (never commit).
- Browser session encrypted on disk (AES-256-GCM via `ENCRYPTION_KEY`).
- Dashboard API protected by `DASHBOARD_PASSWORD` header.
- Rate limiting on `/api/*` (120 req/min).
- Auto re-login on session expiry, retry loop with screenshot on errors.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | /api/messages?q=&otp=1 | List/search messages |
| GET | /api/stats | Counters & top senders |
| GET | /api/status | Scraper + login state |
| POST | /api/start, /api/stop | Control monitoring |
| GET | /api/export.csv | Download all messages |

All `/api/*` calls require header `x-dashboard-password: <DASHBOARD_PASSWORD>`.
