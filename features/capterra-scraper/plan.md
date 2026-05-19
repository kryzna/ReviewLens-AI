# plan.md — Capterra Scraper

## Target files

| File | Action | Purpose |
|------|--------|---------|
| `lib/scrapers/capterra.ts` | CREATE | Capterra scraper implementation |
| `lib/scrapers/capterra.test.ts` | CREATE | Integration tests (5 cases) |
| `lib/scrapers/index.ts` | MODIFY | Register capterraScraper, update error message |
| `features/capterra-scraper/tasks.md` | CREATE | Task checklist |

No other files touched.

---

## Research findings (Phase 2)

- Plain `curl` → 403 (Cloudflare blocks)
- `networkidle` wait → 30s timeout (too many third-party beacons)
- Use `domcontentloaded` + 8–10s `waitForTimeout` — reliable, page fully renders
- JSON-LD block `<script type="application/ld+json">` of type `SoftwareApplication`:
  - `name` → product name
  - `aggregateRating.reviewCount` → total reviews
  - `review[]` → 25 entries per page, each: `author.name`, `reviewBody`, `reviewRating.ratingValue`
- DOM card dates: `div.typo-0.text-neutral-90` — Nth element corresponds to Nth JSON-LD review
- Pagination URL: `?page=N` appended to canonical URL
- Total pages: `Math.ceil(reviewCount / 25)`, also confirmed by max `page=N` in pagination hrefs
- URL formats: both `/p/{id}/{slug}/` and `/software/{id}/{slug}/` work; strip to `/p/` form via redirect

---

## `lib/scrapers/capterra.ts` — pseudocode

```
export const capterraScraper: Scraper = {
  matches(url): boolean {
    // Accept: capterra.com/p/... OR capterra.com/software/...
    hostname === 'capterra.com' (with/without www)
    AND pathname starts with '/p/' OR '/software/'
  },

  async scrape(url, cap, onProgress): Promise<ScrapeResult> {
    // Canonicalise: strip query string, ensure /reviews/ suffix
    const sourceUrl = canonicalise(url)   // → /p/{id}/{slug}/reviews/

    onProgress?.({ type: 'navigating', source: 'Capterra' })

    return scrapeWithPlaywright(sourceUrl, cap, onProgress)
  }
}

async function fetchPlaywrightPage(browser, pageUrl, pageNum, totalPages):
  open new page
  setExtraHTTPHeaders (same UA as Trustpilot)
  goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  waitForTimeout(8_000)
  onProgress?.({ type: 'page-start', pageNum, totalPages })

  // Extract JSON-LD
  const jsonLd = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    for script of scripts:
      data = JSON.parse(script.textContent)
      if data['@type'] === 'SoftwareApplication': return data
    return null
  })

  // Extract dates from DOM (position-matched to JSON-LD reviews)
  const dates = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div.typo-0.text-neutral-90'))
      .map(el => el.textContent?.trim())
  })

  page.close()
  return { jsonLd, dates }

async function scrapeWithPlaywright(sourceUrl, cap, onProgress):
  launch browser (same CHROME_PATHS as trustpilot.ts)

  // Page 1 — sequential, need reviewCount + subjectName
  const { jsonLd: page1ld, dates: page1Dates } = await fetchPlaywrightPage(browser, page1Url, 1, 1)

  if (!page1ld) throw ScraperError(anti-bot message)

  const subjectName = page1ld.name
  const reviewCount = page1ld.aggregateRating?.reviewCount ?? 25
  const reviewsPerPage = page1ld.review?.length ?? 25
  const totalPages = Math.min(Math.ceil(cap / reviewsPerPage), Math.ceil(reviewCount / reviewsPerPage))

  const reviews = extractReviews(page1ld.review, page1Dates, cap, 0)
  onProgress?.({ type: 'page-done', pageNum: 1, totalPages, reviewCount: reviews.length })

  if (totalPages > 1):
    remainingPageNums = [2..totalPages]
    pageResults = await Promise.all(
      remainingPageNums.map(async pageNum => {
        const { jsonLd, dates } = await fetchPlaywrightPage(browser, `${sourceUrl}?page=${pageNum}`, pageNum, totalPages)
        const extracted = extractReviews(jsonLd?.review ?? [], dates, cap, reviews.length)
        onProgress?.({ type: 'page-done', pageNum, totalPages, reviewCount: extracted.length })
        return extracted
      })
    )
    for batch of pageResults: push to reviews (up to cap)

  if reviews.length === 0: throw ScraperError(anti-bot message)
  browser.close()
  return { subjectName, sourceUrl, reviews }

function extractReviews(jsonLdReviews[], dates[], cap, collected):
  for each review (with index i):
    if collected + result.length >= cap: break
    text = review.reviewBody?.trim()
    if !text: continue
    result.push({
      author: review.author?.name?.trim() || undefined,
      rating: review.reviewRating?.ratingValue ?? null,
      date: parseDate(dates[i]) ?? today,
      text,
      verified: true,
      sourceUrl: (passed-in sourceUrl),
    })
  return result

function parseDate(str):
  // e.g. "November 1, 2025" → "2025-11-01"
  new Date(str).toISOString().split('T')[0]
  or return null on invalid
```

---

## URL canonicalisation

```
/p/{id}/{slug}/       → /p/{id}/{slug}/reviews/
/p/{id}/{slug}/reviews/ → unchanged
/software/{id}/{slug}/ → /p/{id}/{slug}/reviews/   (follow redirect OR transform manually)
```

Playwright handles the redirect automatically. Strip query string only.

---

## `lib/scrapers/index.ts` changes

```diff
+ import { capterraScraper } from './capterra';
- const scrapers: Scraper[] = [trustpilotScraper, appStoreScraper, googlePlayScraper];
+ const scrapers: Scraper[] = [trustpilotScraper, appStoreScraper, googlePlayScraper, capterraScraper];

  throw new ScraperError(
-   `No scraper available for this URL. Supported: Trustpilot, Apple App Store, Google Play. Use file upload for other sources.`
+   `No scraper available for this URL. Supported: Trustpilot, Capterra. Use file upload for other sources.`
  );
```

---

## Integration tests — `lib/scrapers/capterra.test.ts`

Fixture: `https://www.capterra.com/p/169455/Zoho-Projects/`

| Test | What it checks |
|------|---------------|
| T1 happy path | `subjectName` truthy, `reviews.length > 0` |
| T2 field mapping | first review: `author` string, `rating` 1–5, `date` YYYY-MM-DD, `text` non-empty, `verified === true` |
| T3 cap=3 | `reviews.length <= 3` |
| T4 pagination cap=30 | `reviews.length >= 25` (forces page 2) |
| T5 bad URL | `scrapeUrl('https://capterra.com/invalid')` throws `ScraperError` |

All tagged `@integration`.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| DOM selector `div.typo-0.text-neutral-90` changes | Date is nice-to-have; fallback to today's date, test only checks YYYY-MM-DD format not specific value |
| JSON-LD structure changes | If `@type !== SoftwareApplication` throw anti-bot ScraperError — still a clean failure |
| Parallel page 403s | Each page opens fresh Playwright page + 8s wait; if 403, `jsonLd` is null → that page returns empty, total may be < cap |
| `/software/` redirect timing | Playwright follows redirect transparently; no special handling needed |

---

## Dependencies added

None. All existing packages sufficient.
