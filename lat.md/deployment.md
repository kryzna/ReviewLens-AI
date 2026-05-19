# Deployment

Fly.io deployment using Docker. App configured in `fly.toml`, container built from `Dockerfile`.

## Playwright on Alpine

Scrapers use `playwright-core` with explicit `executablePath` — no browser auto-download.

Alpine's `chromium` installs to `/usr/bin/chromium-browser`. Dockerfile installs `chromium nss freetype harfbuzz ca-certificates ttf-freefont` for full rendering. Both scrapers launch with `--no-sandbox --disable-setuid-sandbox` (required in containers).

## Database

PostgreSQL via `pg` (node-postgres). Connection string from `DATABASE_URL` env var. Schema auto-applied on first request via `initDb()` (idempotent `CREATE TABLE IF NOT EXISTS`). Pool is a global singleton to survive Next.js hot-reload.

## Deploy Steps (Railway)

End-to-end steps to ship to Railway free tier.

1. Push repo to GitHub
2. New Railway project → Deploy from GitHub
3. Add Railway PostgreSQL plugin (free tier) — `DATABASE_URL` injected automatically
4. Add env var: `ANTHROPIC_API_KEY=sk-...`
5. Deploy — app live at Railway-assigned URL
