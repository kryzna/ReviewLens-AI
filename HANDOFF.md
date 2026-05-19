# ReviewLens AI — Handoff Document
_Last updated: 2026-05-19_

## What This Is

Next.js 15 app that ingests product reviews (Trustpilot, Capterra, App Store, Google Play, CSV/JSONL upload), stores them in SQLite, and lets users chat with Claude AI to analyze sentiment, themes, and patterns. Deployed target: Fly.io (Dockerfile present).

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
  types.ts              # All shared types (Review, Session, Message, ProgressEvent, Scraper, Source)
  db/                   # SQLite via better-sqlite3
  scrapers/
    trustpilot.ts       # Playwright-based (parallelized pages, SSE progress)
    capterra.ts         # Playwright-based (sequential pages, JSON-LD extraction, CF-safe)
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
  ChatPanel.tsx         # Chat UI (SSE fetch stream, paginated citation display)
  TabsClient.tsx        # Tab switcher (CSS hidden, preserves state)
scripts/
  scrape-to-csv.ts      # CLI: scrape URL → CSV for upload testing
features/
  trustpilot-scrape-tests/  # spec/plan/tasks for integration test feature
  capterra-scraper/         # spec/plan/tasks for Capterra scraper feature
```

---

## Key Architecture Decisions

### Ingestion — SSE not JSON
`GET /api/sessions/stream?url=...&cap=...` returns `text/event-stream`. Events:
- `navigating` — scraper started
- `page-start` — page N of M beginning
- `page-done` — page N done, includes `reviewCount`
- `saving` — writing to DB
- `done` — session created, includes `sessionId`
- `error` — failure with `message`

Frontend uses `EventSource` in `NewSessionForm.tsx`.

### Trustpilot — Parallel Pages
Page 1 sequential (need metadata), pages 2–N via `Promise.all`. ~25s total for 10 pages vs ~336s sequential. Playwright required (Cloudflare blocks plain fetch). Uses `__NEXT_DATA__` JSON extraction.

### Capterra — Sequential Pages, JSON-LD
Capterra challenges EVERY page request with Cloudflare (even same browser session). Parallel fetching causes all pages 2–N to fail. Strategy:
- Sequential page fetching (slower but reliable)
- `waitForFunction(() => !document.title.includes('Just a moment'), { timeout: 30_000 })` per page
- Extracts from `SoftwareApplication` JSON-LD: author, rating, reviewBody → text
- DOM `div.typo-0.text-neutral-90` → date (position-matched to JSON-LD reviews)
- `verified = true` for all (Capterra's platform claim)
- 25 reviews/page, total pages = `min(ceil(cap/25), ceil(totalReviews/25))`

### Chat — Streaming + Prompt Caching
`streamMessage()` uses `client.messages.stream()` with `anthropic-beta: prompt-caching-2024-07-31`. System prompt tagged `cache_control: { type: 'ephemeral' }`. Cache TTL 5min.

`POST /api/sessions/[id]/chat` returns SSE: `token`, `done`, `error`.

### Citation Display — Paginated
ChatPanel shows first 3 citations per message. "Show 3 more sources…" reveals next 3. State tracked per message ID via `citationLimit` Map. Inline `[r:uuid]` tokens stripped, deduplicated.

### Tab State Fix
`TabsClient.tsx` uses CSS `hidden` instead of conditional rendering. ChatPanel stays mounted when switching tabs — no history loss.

---

## Source Type Mapping

```ts
type Source = 'trustpilot' | 'appstore' | 'googleplay' | 'capterra' | 'upload'
```

Detected in `stream/route.ts` by URL pattern. Error message: "Supported: Trustpilot, Capterra."

---

## Running Locally

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npx playwright install chromium
npm run dev                   # → http://localhost:3000
```

---

## Tests

```bash
# Trustpilot integration (live network, ~90s)
npx jest lib/scrapers/trustpilot.test.ts --testNamePattern="@integration"

# Capterra integration (live network, ~120s, sequential)
npx jest lib/scrapers/capterra.test.ts --testNamePattern="@integration"
```

Capterra fixture: `https://www.capterra.com/p/169455/Zoho-Projects/`
Trustpilot fixture: `https://www.trustpilot.com/review/www.amazon.com`

---

## Utility Scripts

```bash
node_modules/.bin/tsx scripts/scrape-to-csv.ts [url] [cap] [output.csv]
```

---

## Environment Variables

| Var | Required | Purpose |
|-----|----------|---------|
| `ANTHROPIC_API_KEY` | Yes | Claude API |

SQLite DB auto-created at `data/reviews.db`.

---

## What Shipped This Session

1. Capterra scraper — JSON-LD + DOM hybrid, Cloudflare-safe sequential fetching
2. Capterra pagination fix — `reviewCount` fallback was 25 (1 page), now defaults to `cap`
3. Capterra source type — added `'capterra'` to `Source` union
4. Citation pagination — show 3, expand by 3 on demand
5. Integration tests — 5 passing for Capterra (57s)

---

## Known Gaps / Next Steps

- No auth — anyone with URL can create sessions
- SQLite won't scale beyond single instance — migrate to Postgres before horizontal scaling
- App Store and Google Play scrapers have no integration tests
- Capterra scraper is sequential (Cloudflare constraint) — ~35s/page at 8s wait + CF resolution
- No pagination on Reviews tab — all reviews loaded at once (lags at 500+)
- No rate limiting on ingestion API — one user can trigger many Playwright instances
- QA run never completed — app has not been systematically tested end-to-end
