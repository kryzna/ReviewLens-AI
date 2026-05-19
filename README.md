# ReviewLens AI

Paste a review URL or upload a CSV/JSONL file — get an AI-powered Q&A interface grounded in those reviews.

Live: **https://reviewlens-ai-f6lj.onrender.com**

## Features

- **URL ingest**: Trustpilot and Capterra (headless Chromium, Cloudflare-safe)
- **File upload**: CSV or JSONL (up to 500 reviews, any source)
- **Scoped Q&A**: every answer cites specific reviews via `[r:id]` chips
- **Scope guard**: refuses off-topic questions; styled with amber refusal bubble
- **Session history**: persisted in PostgreSQL, survives restarts

## Quick start

```bash
cp .env.example .env.local     # add ANTHROPIC_API_KEY and DATABASE_URL
npm install
npx playwright install chromium
npm run dev
```

Open `http://localhost:3000`.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key (console.anthropic.com) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |

For local dev, `DATABASE_URL` can point to a local Postgres instance or a free Neon/Supabase database.

## File upload format

**CSV** — required columns: `text`. Optional: `author`, `rating`, `date`, `source_url`, `verified`.

```csv
author,rating,date,text
Alice,5,2024-01-15,Great product
Bob,2,2024-02-01,Stopped working after update
```

**JSONL** — one JSON object per line, same fields:

```jsonl
{"author":"Alice","rating":5,"date":"2024-01-15","text":"Great product"}
{"author":"Bob","rating":2,"text":"Stopped working after update"}
```

## Scraping

### Trustpilot
Uses headless Chromium (Playwright) to bypass Cloudflare. Pages fetched in parallel (~25s for 10 pages). Extracts from `__NEXT_DATA__` JSON.

### Capterra
Sequential page fetching (Cloudflare challenges every page). Extracts from `SoftwareApplication` JSON-LD + DOM date extraction. ~35s/page at worst.

Both scrapers require Chromium:
- **macOS**: `npx playwright install chromium`
- **Linux**: `apt install chromium-browser`
- **Docker**: bundled via `apk add chromium`

> **ToS note**: Scraping review platforms may violate their Terms of Service. Use for personal or research purposes only.

## Architecture

- **Framework**: Next.js 15 App Router + TypeScript + Tailwind
- **AI**: Anthropic Claude (claude-sonnet-4-6) with prompt caching (5-min TTL)
- **DB**: PostgreSQL via `pg` (node-postgres); schema auto-applied on cold start
- **Scraping**: playwright-core with system Chromium (no browser auto-download)
- **Q&A strategy**: stuff-in-context (no RAG) — all reviews in system prompt per turn

Session IDs are UUIDs. Anyone with a session URL can read its history — no auth.

## Deploy to Render

1. Push to GitHub
2. New Render project → Web Service (Docker) from repo
3. Add PostgreSQL database — `DATABASE_URL` auto-injected
4. Set `ANTHROPIC_API_KEY` env var
5. Deploy

## Running tests

```bash
npm test

# Integration tests (live network, require Chromium)
npx jest lib/scrapers/trustpilot.test.ts --testNamePattern="@integration"   # ~90s
npx jest lib/scrapers/capterra.test.ts --testNamePattern="@integration"     # ~120s
```

## Assumptions

- 500 review cap per session keeps ingestion under ~60s and token cost bounded
- Stuff-in-context Q&A is sufficient at ≤500 reviews; revisit with embeddings if cap grows past ~5k
- Single Postgres instance; not designed for concurrent load or horizontal scaling

## Known limitations

- No auth — anyone with a session URL can read its chat history
- Scope guard (system prompt only) is bypassable by determined prompt injection
- Capterra scraper is sequential due to Cloudflare; ~35s per page
- No rate limiting on ingestion API — one user can trigger many Playwright instances
- No pagination on Reviews tab beyond load-more (lags at 500+ reviews)
- App Store and Google Play scrapers exist but have no integration tests and are not advertised in the UI
