# spec.md — Trustpilot Playwright Scrape Integration Tests

## 1. Mandate

Add integration tests to `lib/scrapers/trustpilot.test.ts` that exercise the Playwright scraping path against live Trustpilot, verifying field mapping, pagination, cap enforcement, and error handling for a real product URL.

## 2. Tech Stack (pinned)

- Jest 29.7
- ts-jest (commonjs transform)
- playwright-core ^1.60.0 (used by production code — no extra install)
- TypeScript 5.4
- Node test environment

## 3. Data Models

`ScrapeResult` (from `lib/types.ts`):
```ts
interface ScrapeResult {
  subjectName: string;
  sourceUrl: string;
  reviews: Array<{
    author?: string;
    rating: number | null;
    date: string;         // YYYY-MM-DD
    text: string;
    verified: boolean;
    sourceReviewId?: string;
    sourceUrl?: string;
  }>;
}
```

## 4. Non-Goals

- No mock/fixture tests (user explicitly requested real network)
- No fetch-fallback path tests
- No CI gate (tests are network-dependent, must be opt-in)
- No new scraper logic — tests only

## 5. Boundary Conditions

- Tests marked with `jest.setTimeout` >= 60_000 ms (Playwright + network is slow)
- Test file tagged with a `@integration` describe label so it can be skipped in unit-only runs
- Never commit Trustpilot credentials or session tokens
- Do not call `trustpilotScraper.scrape` from unit tests that run in CI without network
- Use a stable, public Trustpilot product page (e.g. `https://www.trustpilot.com/review/www.amazon.com`) — well-known, hundreds of pages, unlikely to disappear

## 6. Test Cases

| # | Description | What to assert |
|---|-------------|---------------|
| T1 | Happy path — returns reviews | `subjectName` non-empty string, `reviews.length >= 1`, `sourceUrl` matches input |
| T2 | Field mapping | First review has `text` (non-empty string), `rating` in [1–5] or null, `date` matches YYYY-MM-DD, `author` string or undefined, `verified` boolean, `sourceReviewId` string or undefined |
| T3 | Cap enforcement | `scrape(url, 3)` returns exactly 3 reviews |
| T4 | Pagination | `scrape(url, 25)` returns 25 reviews (forces page 2 since Trustpilot shows ~20/page) |
| T5 | Invalid URL (no reviews page) | `scrape('https://www.trustpilot.com/review/__nonexistent__xyz__', 10)` throws `ScraperError` |

## 7. Escalation Protocol

Encounter missing dependency, conflicting schema, ambiguous requirement, or contradiction between this spec and existing codebase: **stop**. Describe blocker one paragraph, propose 2–3 options with tradeoffs, ask clarification. **No speculative code.**
