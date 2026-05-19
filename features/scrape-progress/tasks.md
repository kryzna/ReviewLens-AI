# tasks.md — Scrape Progress Indicators

- [ ] T1. Add ProgressEvent + ProgressCallback to lib/types.ts, update Scraper interface
  - Files: lib/types.ts
  - Depends on: —

- [ ] T2. Wire onProgress into trustpilot scraper (both Playwright + fetch paths)
  - Files: lib/scrapers/trustpilot.ts
  - Depends on: T1

- [ ] T3. Wire onProgress into appstore scraper
  - Files: lib/scrapers/appstore.ts
  - Depends on: T1

- [ ] T4. Wire onProgress into googleplay scraper
  - Files: lib/scrapers/googleplay.ts
  - Depends on: T1

- [ ] T5. Thread onProgress through scrapeUrl() in index.ts
  - Files: lib/scrapers/index.ts
  - Depends on: T1

- [ ] T6. Create SSE endpoint app/api/sessions/stream/route.ts
  - Files: app/api/sessions/stream/route.ts
  - Depends on: T2, T3, T4, T5

- [ ] T7. Update NewSessionForm to use EventSource + show step list
  - Files: components/NewSessionForm.tsx
  - Depends on: T6
