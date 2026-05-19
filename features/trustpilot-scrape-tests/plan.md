# plan.md — Trustpilot Playwright Scrape Integration Tests

## Files

- `lib/scrapers/trustpilot.test.ts` — extend existing file, add integration describe block

## Approach

Call `trustpilotScraper.scrape()` directly (public interface). Playwright path executes when Chrome found on host. Tests are real network — no mocks.

URL: `https://www.trustpilot.com/review/www.amazon.com` (~20 reviews/page, hundreds of pages).

## Risks

- Chrome not present on CI → Playwright throws, falls back to fetch (still covers behavior)
- Trustpilot bot detection changes HTML structure → tests fail at scraper level, not test level
- Network timeout → mitigated by `jest.setTimeout(120_000)`
