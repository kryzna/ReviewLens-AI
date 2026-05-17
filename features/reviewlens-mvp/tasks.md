# ReviewLens MVP — Tasks

## Build order

Dependencies flow top→bottom. Parallel execution allowed where "Depends on: —".

---

- [x] **T01. Project scaffold**
  - Files: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `app/globals.css`, `app/layout.tsx`, `.gitignore`
  - Tests: `npm run build` exits 0; `npm run dev` starts without error
  - Depends on: —

- [x] **T02. Shared types**
  - Files: `lib/types.ts`
  - Tests: `tsc --noEmit` on the file passes
  - Depends on: T01

- [x] **T03. DB schema + client + repo**
  - Files: `lib/db/schema.sql`, `lib/db/client.ts`, `lib/db/repo.ts`
  - Tests: unit test — repo inserts session + reviews, reads back, cascade deletes
  - Depends on: T02

- [x] **T04. Trustpilot scraper**
  - Files: `lib/scrapers/trustpilot.ts`, `lib/scrapers/trustpilot.test.ts`, `fixtures/trustpilot.html`
  - Tests: parse saved HTML fixture → expect ≥1 review with author/rating/date/text; `matches()` true for `trustpilot.com/review/*` URL
  - Depends on: T02

- [x] **T05. Apple App Store scraper**
  - Files: `lib/scrapers/appstore.ts`, `lib/scrapers/appstore.test.ts`, `fixtures/appstore.json`
  - Tests: parse saved RSS JSON fixture → expect ≥1 review with rating/date/text; all `verified: true`; `matches()` true for `apps.apple.com/*`
  - Depends on: T02

- [x] **T06. Google Play scraper**
  - Files: `lib/scrapers/googleplay.ts`, `lib/scrapers/googleplay.test.ts`
  - Tests: mock `google-play-scraper` → verify field mapping (userName→author, score→rating, thumbsUp→extra.thumbsUp); `matches()` true for `play.google.com/store/apps/details?id=*`
  - Depends on: T02

- [x] **T07. Scraper dispatcher**
  - Files: `lib/scrapers/index.ts`
  - Tests: dispatcher returns correct scraper for each URL host; throws for unrecognized URL
  - Depends on: T04, T05, T06

- [x] **T08. File ingest (CSV + JSONL) + normalize**
  - Files: `lib/ingest/parseCsv.ts`, `lib/ingest/parseJsonl.ts`, `lib/ingest/normalize.ts`, `lib/ingest/normalize.test.ts`, `fixtures/sample.csv`, `fixtures/sample.jsonl`
  - Tests: valid CSV → Review[]; missing required field → per-row error array; JSONL valid → Review[]; JSONL malformed line → error; normalize computes ratingDist/avg/dateMin/Max correctly
  - Depends on: T02

- [x] **T09. POST /api/sessions (ingest route)**
  - Files: `app/api/sessions/route.ts`
  - Tests: POST with valid Trustpilot URL (mocked scraper) → 201 `{sessionId}`; POST with bad URL → 400; POST with valid CSV multipart → 201
  - Depends on: T03, T07, T08

- [x] **T10. GET /api/sessions + GET /api/sessions/[id]**
  - Files: `app/api/sessions/route.ts` (GET handler), `app/api/sessions/[id]/route.ts`
  - Tests: GET /api/sessions → array of sessions; GET /api/sessions/[id] → session + paginated reviews (`?offset&limit`); unknown id → 404
  - Depends on: T03

- [x] **T11. LLM client + prompt builder + citation parser**
  - Files: `lib/llm/client.ts`, `lib/llm/prompt.ts`, `lib/llm/citations.ts`, `lib/llm/citations.test.ts`
  - Tests: `parseCitations("[r:abc123] good product [r:def456]")` → `["abc123","def456"]`; prompt builder includes all reviews + scope rules; client singleton initializes with env var
  - Depends on: T02

- [x] **T12. Scope pre-check**
  - Files: `lib/guard/preCheck.ts`
  - Tests: empty string → throws; `"hi"` (< 3 chars trimmed) → throws; valid question → passes
  - Depends on: —

- [x] **T13. LLM chat orchestration**
  - Files: `lib/llm/chat.ts`
  - Tests: (integration, skipped in CI) — unit: history over budget triggers summarization; messages array shaped correctly for Anthropic SDK
  - Depends on: T11, T12

- [x] **T14. POST /api/sessions/[id]/chat + GET messages**
  - Files: `app/api/sessions/[id]/chat/route.ts`, `app/api/sessions/[id]/messages/route.ts`
  - Tests: POST with mocked LLM → 200 `{message}` persisted; pre-check failure → 400; unknown session → 404; GET messages → ordered array
  - Depends on: T03, T13

- [x] **T15. UI components — sidebar + new session form**
  - Files: `components/SessionSidebar.tsx`, `components/NewSessionForm.tsx`
  - Tests: visual — render sidebar with 2 sessions → both names appear; active session highlighted; form POST on submit; file drop triggers ingest
  - Depends on: T01

- [x] **T16. UI components — summary card + star distribution**
  - Files: `components/SummaryCard.tsx`, `components/StarDistribution.tsx`
  - Tests: visual — SummaryCard renders subject name, rating, review count, date range, source badge; StarDistribution renders 5 bars with correct widths
  - Depends on: T01

- [x] **T17. UI components — chat panel + citation chip**
  - Files: `components/ChatPanel.tsx`, `components/CitationChip.tsx`
  - Tests: visual — user message right-aligned; assistant message left-aligned; `[refusal]` prefix → amber border + shield; CitationChip click calls scroll handler; suggestion chip sends message
  - Depends on: T01

- [x] **T18. UI components — reviews panel**
  - Files: `components/ReviewsPanel.tsx`
  - Tests: visual — renders review cards with stars/author/date/text; filter chips filter by rating; load-more increments offset; "Showing N of total" footer
  - Depends on: T01

- [x] **T19. App pages**
  - Files: `app/page.tsx`, `app/session/[id]/page.tsx`
  - Tests: `npm run build` passes; page.tsx renders NewSessionForm; session page fetches + hydrates AnalysisView; `/session/unknown-id` → 404
  - Depends on: T15, T16, T17, T18, T10

- [x] **T20. Deploy config + README**
  - Files: `Dockerfile`, `fly.toml`, `.dockerignore`, `README.md`, `ai-transcripts/.gitkeep`
  - Tests: `docker build` succeeds; README covers setup, deploy, env vars, known limitations
  - Depends on: T01

---

## Parallel groups

| Group | Tasks | Gate |
|-------|-------|------|
| A | T04, T05, T06, T08, T12 | T02 done |
| B | T07 | T04+T05+T06 done |
| C | T09 | T03+T07+T08 done |
| D | T10, T11 | T03 done |
| E | T13 | T11+T12 done |
| F | T14 | T03+T13 done |
| G | T15, T16, T17, T18 | T01 done (parallel with backend) |
| H | T19 | T15+T16+T17+T18+T10 done |
| I | T20 | T01 done |
