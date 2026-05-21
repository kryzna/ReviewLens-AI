# Scrapers

Review ingestion via two strategies: Playwright (JS-rendered pages) with anti-detection flags, and raw HTML fetch fallback. Supported platforms: Trustpilot, Capterra, G2, App Store, Google Play.

## Trustpilot Scraper

Tries `scrapeWithPlaywright` first (handles JS rendering), falls back to `scrapeWithFetch` only on non-ScraperError.

If Playwright browser is not installed, the error is surfaced directly with an install hint rather than falling through to fetch (which would also get blocked).

## Capterra Scraper

Tries `scrapeWithPlaywright` first; falls back to `scrapeWithFetch` (regex JSON-LD from raw HTML) if Playwright returns a ScraperError. Dates are unavailable in the fetch path and default to today.

URL slugs are lowercased in `canonicalise()` to handle casing variations (e.g. `JIRA` → `jira`).

## G2 Scraper

Playwright-first with fetch fallback, same pattern as Capterra. See [[lib/scrapers/g2.ts]].

Extracts via schema.org microdata (`[itemtype="http://schema.org/Review"]`) — more stable than CSS class selectors. 2 s inter-page delay to avoid G2 rate limits. Capped at 10 pages.

## App Store Scraper

Uses iTunes RSS API (`itunes.apple.com/rss/customerreviews`) — no Playwright needed. Up to 10 pages × 50 reviews per page. See [[lib/scrapers/appstore.ts]].

## Google Play Scraper

Uses `google-play-scraper` npm package. See [[lib/scrapers/googleplay.ts]].

## Rate Limiting

All ingestion endpoints (`POST /api/sessions`, `GET /api/sessions/stream`) enforce a per-IP rate limit of 5 requests per minute via [[lib/rate-limit.ts]]. Returns HTTP 429 with `Retry-After` header on breach.

## Concurrency Control

A shared `pooledMap` utility caps in-flight tasks to avoid OOM when `cap` is large (e.g. 500 → 24+ pages). Playwright uses `concurrency=1` (sequential); fetch uses `concurrency=5`.

Playwright pages are fetched sequentially with a **1.5 s inter-page delay** to avoid Trustpilot rate-limiting, which returns silently empty pages under parallel load. On an empty page, a single retry fires after **3 s**.

## Anti-Detection

All scrapers use `playwright-core` directly (no `playwright-extra` or stealth plugin). Anti-detection via:
- `--disable-blink-features=AutomationControlled`
- Spoofed Chrome user-agent
- `Accept-Language` and other browser-like headers

See [[deployment#Playwright on Alpine]] for container setup.

## Progress Events

All scrapers emit `page-start` and `page-done` progress events via the `onProgress` callback. The stream route forwards these as SSE events so the UI can show live page counts.

## Error Handling in UI

On an `error` SSE event, the client clears all step and page progress state (steps, pages) and shows only the error message. This prevents the confusing state where partial progress is visible alongside a terminal error.
