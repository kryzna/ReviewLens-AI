# ReviewLens AI — Handoff Document
_Last updated: 2026-05-19_

## What This Is

Next.js 15 app that ingests product reviews (Trustpilot, App Store, Google Play, CSV/JSONL upload), stores them in SQLite, and lets users chat with Claude AI to analyze sentiment, themes, and patterns. Deployed target: Fly.io (Dockerfile present).

---

## Stack

| Layer | Tech | Version |
|-------|------|---------|
| Framework | Next.js (App Router) | 15.5.18 |
| UI | React + Tailwind | 19.x / 3.4 |
| AI | Anthropic SDK | 0.51.0 |
| DB | better-sqlite3 | 11.9.1 |
| Scraping | Playwright Core + Cheerio | 1.60.0 / 1.0.0 |
| Testing | Jest 29 + ts-jest | 29.7.0 |
| Runtime scripts | tsx | 4.22.2 |

---

## Project Structure

```
app/
  api/
    sessions/
      route.ts          # POST: CSV/JSONL file upload → new session
      stream/route.ts   # GET SSE: URL ingestion with progress events
      [id]/
        chat/route.ts   # POST SSE: streaming chat response
        route.ts        # GET: session details
lib/
  types.ts              # All shared types (Review, Session, Message, ProgressEvent, Scraper)
  db/                   # SQLite via better-sqlite3
  scrapers/
    trustpilot.ts       # Playwright-based (parallelized, SSE progress)
    appstore.ts         # RSS feed scraper
    googleplay.ts       # google-play-scraper npm package
    index.ts            # scrapeUrl() — selects correct scraper
  llm/
    chat.ts             # streamMessage() — streaming + prompt caching
    prompt.ts           # System prompt builder
    citations.ts        # Citation token parser
  guard/
    preCheck.ts         # Input validation / refusal guard
  ingest/               # File parse (CSV, JSONL)
components/
  NewSessionForm.tsx    # Ingestion UI (SSE EventSource, step list, page chips)
  ChatPanel.tsx         # Chat UI (SSE fetch stream, citation display)
  TabsClient.tsx        # Tab switcher (CSS hidden, preserves state)
scripts/
  scrape-to-csv.ts      # CLI: scrape URL → CSV for upload testing
features/
  trustpilot-scrape-tests/  # spec/plan/tasks for integration test feature
```

---

## Key Architecture Decisions

### Ingestion — SSE not JSON
`GET /api/sessions/stream?url=...&cap=...` returns `text/event-stream`. Events:
- `navigating` — scraper started, navigating to source
- `page-start` — page N of M beginning
- `page-done` — page N done, includes `reviewCount`
- `saving` — writing to DB
- `done` — session created, includes `sessionId`
- `error` — failure with `message`

Frontend uses `EventSource` in `NewSessionForm.tsx`.

### Trustpilot Scraping — Parallel Pages
Page 1 fetches sequentially (need total page count + metadata). Pages 2–N fetched via `Promise.all`. Old: ~13s/page × N. New: ~25s total for 10 pages.

Playwright required (Cloudflare blocks plain fetch). Headless Chromium, no `DELAY_MS`.

### Chat — Streaming + Prompt Caching
`streamMessage()` in `lib/llm/chat.ts` uses `client.messages.stream()` with header `anthropic-beta: prompt-caching-2024-07-31`. System prompt tagged `cache_control: { type: 'ephemeral' }`. Cache TTL 5min — subsequent messages in same session pay ~0 on system prompt tokens.

`POST /api/sessions/[id]/chat` returns SSE with events: `token`, `done`, `error`.

### Tab State Fix
`TabsClient.tsx` uses CSS `hidden` class instead of conditional rendering. ChatPanel stays mounted when user switches to Reviews tab — no history loss.

### Citation Display
LLM embeds `[r:uuid]` tokens inline. `parseMessage()` in `ChatPanel.tsx` strips them, deduplicates IDs, renders a "Sources" section below each assistant message with author, rating, and truncated review text.

---

## Running Locally

```bash
# Install deps (requires Node 20+)
npm install

# Copy env and add ANTHROPIC_API_KEY
cp .env.example .env.local

# Dev server
npm run dev
# → http://localhost:3000
```

Playwright needs Chromium:
```bash
npx playwright install chromium
```

---

## Tests

```bash
# All tests
npm test

# Trustpilot integration tests (hits live Trustpilot, ~90s, needs network)
npx jest lib/scrapers/trustpilot.test.ts --testNamePattern="@integration"
```

Integration tests use `https://www.trustpilot.com/review/www.amazon.com`. 5 cases: happy path, field mapping, cap enforcement, pagination, invalid URL error.

---

## Utility Scripts

```bash
# Scrape URL to CSV (for testing upload flow)
node_modules/.bin/tsx scripts/scrape-to-csv.ts [url] [cap] [output.csv]

# Example
node_modules/.bin/tsx scripts/scrape-to-csv.ts https://www.trustpilot.com/review/stripe.com 25 stripe-reviews.csv
```

CSV columns: `author,rating,date,text,source_url,verified`

---

## Environment Variables

| Var | Purpose |
|-----|---------|
| `ANTHROPIC_API_KEY` | Required. Claude API access |

No other secrets needed for local dev. SQLite DB auto-created at `data/reviews.db` on first run.

---

## What Was Built This Session

1. **Integration tests** — `lib/scrapers/trustpilot.test.ts` (5 tests, all passing)
2. **CSV export script** — `scripts/scrape-to-csv.ts`
3. **SSE ingestion progress** — new `app/api/sessions/stream/route.ts`, updated `NewSessionForm.tsx`
4. **Max reviews input** — cap picker in ingestion UI (1–500, default 50)
5. **Parallel page fetching** — Trustpilot pages 2–N via `Promise.all`, page-progress chips in UI
6. **Tab state fix** — CSS hidden in `TabsClient.tsx`
7. **Streaming chat** — SSE from `chat/route.ts`, real-time token updates in `ChatPanel.tsx`
8. **Prompt caching** — system prompt cached with `anthropic-beta` header
9. **Citation UI** — inline tokens stripped, "Sources" section rendered below messages

---

## Known Gaps / Next Steps

- No auth — anyone with URL can create sessions. Add Clerk or NextAuth if going multi-tenant.
- SQLite won't scale beyond single instance. Migrate to Postgres (Fly Postgres or Neon) before horizontal scaling.
- Trustpilot scraper is fragile — Playwright-based, depends on DOM structure. Add retry logic and alert on scrape failures.
- No rate limiting on `/api/sessions/stream` — a single user can trigger many parallel Playwright instances.
- App Store and Google Play scrapers have no integration tests.
- No pagination on the Reviews tab — all reviews loaded at once. Will lag with 500+ reviews.
- QA run not completed (session ended before /qa finished).
