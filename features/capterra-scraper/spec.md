# spec.md — Capterra Scraper

## 1. Mandate

Add a Capterra scraper that extracts product reviews via Playwright, maps them to the existing `Review` type, and integrates with the existing SSE ingestion pipeline — so users can paste a Capterra URL and get the same cap/progress/parallel-page experience as Trustpilot.

---

## 2. Tech Stack (pinned)

- playwright-core ^1.60.0 (already installed)
- Next.js 15.5.18 / Node 20 (existing)
- TypeScript 5.4.5 (existing)
- Jest 29 + ts-jest 29.7.0 (existing, for integration tests)
- No new dependencies required

---

## 3. Data Models

### Supported URL formats
Both resolve to the same product review page:
- `https://www.capterra.com/p/{id}/{product-name}/`
- `https://www.capterra.com/software/{id}/{product-name}/`

`matches()` accepts either. Both stripped to canonical form before scraping.

### Data source — Hybrid (JSON-LD + DOM)

Capterra embeds a `SoftwareApplication` JSON-LD block in every page containing 25 reviews. Pros/cons are collapsed behind JS interactions and not reliably extractable without per-card clicking (too slow/brittle). Date IS rendered in the visible DOM card.

Strategy:
- **JSON-LD** → `author`, `rating`, `text` (reviewBody), `subjectName`, `aggregateRating.reviewCount`
- **DOM** → `date` per card (matched by position to JSON-LD reviews)
- `verified = true` for all (Capterra claims all reviews are verified users)
- No `sourceReviewId` (not present in JSON-LD)

### Field mapping — Capterra → Review

| Source | Capterra field | Review field | Notes |
|--------|----------------|--------------|-------|
| JSON-LD | `review[].author.name` | `author` | string or undefined |
| JSON-LD | `review[].reviewRating.ratingValue` | `rating` | number 1–5 or null |
| DOM | `div.typo-0.text-neutral-90` text (Nth card) | `date` | ISO YYYY-MM-DD; fallback today |
| JSON-LD | `review[].reviewBody` | `text` | review headline/summary |
| Platform | all Capterra reviews | `verified` | `true` always |
| Page URL | constructed | `sourceUrl` | canonical page URL |

### ScrapeResult
No change to existing type — `{ subjectName: string, sourceUrl: string, reviews: Review[] }`.
`subjectName` = product name from page heading.

---

## 4. Non-Goals

- No fallback to plain fetch (Playwright-only)
- No sub-ratings (ease-of-use, features, value/price, customer support) — overall only
- G2, GetApp, Software Advice not supported
- No login-gated reviews
- No review filtering (sort, date range) — always fetches most-recent order as Capterra serves it
- No removing existing App Store / Google Play scrapers from `lib/scrapers/` — only update `index.ts` error message and supported-sources list

---

## 5. Boundary Conditions

- Cap 1–500, default 500, parallel pages 2–N via `Promise.all` (identical to Trustpilot)
- If 0 reviews extracted: throw `ScraperError('Unable to extract reviews due to Capterra\'s anti-bot policy. Try file upload instead.')`
- Invalid / non-Capterra URL: `matches()` returns false → existing `ScraperError` from `findScraper`
- Emit `navigating`, `page-start`, `page-done` progress events (same shape as Trustpilot)
- Page timeout: 30s per page (same as Trustpilot)
- `CHROME_PATHS` lookup: reuse same list already in `trustpilot.ts` (extract to shared util or duplicate — plan decides)
- Never commit `.env`, secrets, or credentials
- Never edit `node_modules/`

---

## 6. Escalation Protocol

Encounter missing dependency, conflicting schema, ambiguous requirement, or contradiction between this spec and existing codebase: **stop**. Describe blocker one paragraph, propose 2–3 options with tradeoffs, ask clarification. **No speculative code.**

---

## 7. Integration Tests

File: `lib/scrapers/capterra.test.ts`
Fixture URL: `https://www.capterra.com/p/169455/Zoho-Projects/`

5 cases (tagged `@integration`):
- T1: happy path — returns `subjectName`, non-empty `reviews`
- T2: field mapping — first review has `author`, `rating` (1–5), `date` (YYYY-MM-DD), `text` containing "Pros:" or "Cons:" or non-empty, `verified` boolean
- T3: cap enforcement — `cap=3` returns ≤3 reviews
- T4: pagination — `cap=30` returns ≥25 reviews (forces page 2)
- T5: bad URL → `ScraperError`

---

## 8. index.ts Changes

- Add `capterraScraper` to `scrapers[]` array
- Update `findScraper` error message: `"No scraper available for this URL. Supported: Trustpilot, Capterra. Use file upload for other sources."`
