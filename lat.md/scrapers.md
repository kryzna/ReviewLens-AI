# Scrapers

Review ingestion via two strategies: Playwright (JS-rendered pages) with anti-detection flags, and raw HTML fetch fallback. Both Trustpilot ([[lib/scrapers/trustpilot.ts]]) and Capterra ([[lib/scrapers/capterra.ts]]) try Playwright first and fall back to plain fetch when blocked.

## Trustpilot Scraper

Tries `scrapeWithPlaywright` first (handles JS rendering), falls back to `scrapeWithFetch` only on non-ScraperError.

If Playwright browser is not installed, the error is surfaced directly with an install hint rather than falling through to fetch (which would also get blocked).

## Capterra Scraper

Tries `scrapeWithPlaywright` first; falls back to `scrapeWithFetch` (regex JSON-LD from raw HTML) if Playwright returns a ScraperError. Dates are unavailable in the fetch path and default to today.

URL slugs are lowercased in `canonicalise()` to handle casing variations (e.g. `JIRA` → `jira`).

## Concurrency Control

A shared `pooledMap` utility caps in-flight tasks to avoid OOM when `cap` is large (e.g. 500 → 24+ pages). Playwright uses `concurrency=1` (sequential); fetch uses `concurrency=5`.

Playwright pages are fetched sequentially with a **1.5 s inter-page delay** to avoid Trustpilot rate-limiting, which returns silently empty pages under parallel load. On an empty page, a single retry fires after **3 s**.

The fetch path has no such delay — HTML endpoints are less aggressively rate-limited.

## Anti-Detection

Both scrapers use `playwright-core` directly (no `playwright-extra` or stealth plugin). Anti-detection via:
- `--disable-blink-features=AutomationControlled`
- Spoofed Chrome user-agent
- `Accept-Language` and other browser-like headers

See [[deployment#Playwright on Alpine]] for container setup.

## Progress Events

Both scrapers emit `page-start` and `page-done` progress events via the `onProgress` callback. The stream route forwards these as SSE events so the UI can show live page counts.

## Error Handling in UI

On an `error` SSE event, the client clears all step and page progress state (steps, pages) and shows only the error message. This prevents the confusing state where partial progress is visible alongside a terminal error.
