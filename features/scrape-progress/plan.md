# plan.md — Scrape Progress Indicators

## Files

| File | Change |
|------|--------|
| `lib/types.ts` | Add `ProgressEvent`, `ProgressCallback` types; update `Scraper.scrape` signature |
| `lib/scrapers/trustpilot.ts` | Emit `navigating` + `extracting` via `onProgress` |
| `lib/scrapers/appstore.ts` | Emit `navigating` + `extracting` via `onProgress` |
| `lib/scrapers/googleplay.ts` | Emit `navigating` + `extracting` via `onProgress` |
| `lib/scrapers/index.ts` | Thread `onProgress` through `scrapeUrl()` |
| `app/api/sessions/stream/route.ts` | New SSE GET endpoint — runs scraper, streams events, inserts session |
| `components/NewSessionForm.tsx` | Use `EventSource` for URL ingestion; show numbered step list |

## SSE Endpoint Flow

1. Validate `url` param → 400 if missing/unsupported
2. Emit `navigating`
3. Call `scrapeUrl(url, 500, onProgress)` — emits `extracting` per page
4. Emit `saving`
5. Insert session + reviews to DB
6. Emit `done` with `sessionId`
7. On any error → emit `error`, close stream

## Scraper Progress Points

- **Trustpilot**: emit `extracting` after each page loop iteration (Playwright + fetch paths)
- **AppStore**: emit `extracting` after each RSS page fetch
- **GooglePlay**: emit `extracting` once after bulk fetch (single batch)
