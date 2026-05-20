# ReviewLens AI

Paste a review URL or upload a CSV/JSONL file — get an AI-powered Q&A interface grounded in those reviews.

Live: **https://reviewlens-ai-f6lj.onrender.com**

## Features

- **URL ingest**: Trustpilot and Capterra (headless Chromium, Cloudflare-safe, up to 500 reviews)
- **File upload**: CSV or JSONL (any source)
- **Proactive Insight Brief**: auto-generated on session load — top 3 themes, verbatim quotes, sentiment label + star score — before you ask anything
- **Quick-start prompts**: 4 analytical questions in empty chat state, disappear after first message
- **Contextual follow-up chips**: after each AI response, 2-3 LLM-generated follow-up questions appear as clickable chips
- **Scoped Q&A**: every answer cites specific reviews via inline `[r:id]` source chips
- **Scope guard**: refuses off-topic questions; styled with a refusal bubble
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
Uses headless Chromium (Playwright) to bypass Cloudflare. Pages fetched with a concurrency limit of 3 tabs to stay within memory bounds. Extracts from `__NEXT_DATA__` JSON. Falls back to plain `fetch` if Playwright fails.

### Capterra
Sequential page fetching (Cloudflare challenges every page). Extracts from `SoftwareApplication` JSON-LD + DOM date extraction.

Both scrapers require Chromium:
- **macOS**: `npx playwright install chromium`
- **Linux**: `apt install chromium-browser`
- **Docker**: bundled via `apk add chromium`

> **ToS note**: Scraping review platforms may violate their Terms of Service. Use for personal or research purposes only.

## Architecture

- **Framework**: Next.js 15 App Router + TypeScript + Tailwind
- **AI**: Anthropic Claude `claude-sonnet-4-6` with prompt caching (5-min TTL)
- **DB**: PostgreSQL via `pg` (node-postgres); schema auto-applied on cold start
- **Scraping**: playwright-core with system Chromium (no browser auto-download)
- **Q&A strategy**: stuff-in-context (no RAG) — all reviews in system prompt per turn
- **Insight brief**: dedicated non-streaming LLM call at session load (`GET /api/sessions/[id]/insight`)
- **Follow-up chips**: per-response LLM call after each assistant stream completes (`POST /api/sessions/[id]/followups`)

Session IDs are UUIDs, click-to-copy in the session header. Anyone with a session URL can read its history — no auth.

## Demo recorder

A Playwright-based script records a full app walkthrough to `demo-out/demo.mp4`:

```bash
node scripts/record-demo.js

# Options (env vars):
BASE_URL=http://localhost:3000          # default: live Render URL
EXISTING_SESSION_ID=<uuid>             # skip ingestion, jump to this session
REVIEW_CAP=15                          # reviews to ingest (default: 15)
CHROME_PATH=/path/to/chrome            # override Chrome executable
```

Requires ffmpeg (`brew install ffmpeg`).

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
npx jest lib/scrapers/trustpilot.test.ts --testNamePattern="@integration"
npx jest lib/scrapers/capterra.test.ts --testNamePattern="@integration"
```

## Assumptions

- 500 review cap per session keeps token cost bounded; scraper concurrency limited to 3 Playwright tabs to avoid OOM on free-tier hosts (512 MB RAM)
- Stuff-in-context Q&A is sufficient at ≤500 reviews; revisit with embeddings if cap grows past ~5k
- Single Postgres instance; not designed for concurrent load or horizontal scaling

## Known limitations

- No auth — anyone with a session URL can read its chat history
- Scope guard (system prompt only) is bypassable by determined prompt injection
- Capterra scraper is sequential due to Cloudflare
- No rate limiting on ingestion API
- No pagination on Reviews tab beyond load-more
- App Store and Google Play scrapers exist but have no integration tests and are not advertised in the UI
