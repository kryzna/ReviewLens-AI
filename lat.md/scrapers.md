# Scrapers

Review ingestion via two strategies: Playwright (JS-rendered pages) with stealth, and raw HTML fetch. Both use [[lib/scrapers/trustpilot.ts]] as the reference implementation.

## Trustpilot Scraper

Tries `scrapeWithPlaywright` first (stealth, handles JS rendering), falls back to `scrapeWithFetch` only on non-ScraperError.

If Playwright browser is not installed, the error is surfaced directly with an install hint rather than falling through to fetch (which would also get blocked).

## Concurrency Control

A shared `pooledMap` utility caps in-flight tasks to avoid OOM when `cap` is large (e.g. 500 → 24+ pages). Playwright uses `concurrency=1` (sequential); fetch uses `concurrency=5`.

Playwright pages are fetched sequentially with a **1.5 s inter-page delay** to avoid Trustpilot rate-limiting, which returns silently empty pages under parallel load. On an empty page, a single retry fires after **3 s**.

The fetch path has no such delay — HTML endpoints are less aggressively rate-limited.

## Stealth

Playwright launches via `playwright-extra` + `puppeteer-extra-plugin-stealth`. Stealth randomizes canvas, WebGL, and headless fingerprints. See [[deployment#Playwright on Alpine]] for container setup.

`playwright-extra-plugin-stealth` is a broken stub — use `puppeteer-extra-plugin-stealth` instead (compatible with `playwright-extra`). Its CJS dependency chain (`puppeteer-extra-plugin`, `merge-deep`, `clone-deep`) must be in `serverExternalPackages` in `next.config.js` to prevent Next.js webpack static analysis errors.

## Progress Events

Both scrapers emit `page-start` and `page-done` progress events via the `onProgress` callback. The stream route forwards these as SSE events so the UI can show live page counts.

## Error Handling in UI

On an `error` SSE event, the client clears all step and page progress state (steps, pages) and shows only the error message. This prevents the confusing state where partial progress is visible alongside a terminal error.
