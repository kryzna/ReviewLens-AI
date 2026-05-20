import type { Scraper, ScrapeResult, ProgressCallback } from '@/lib/types';
import { ScraperError } from '@/lib/types';

const REVIEW_CAP = 500;

// Chrome on macOS/Linux/Windows
const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

// Process items with at most `concurrency` in-flight at once.
// Prevents OOM when cap=500 spawns 24+ parallel Playwright tabs or fetch requests.
async function pooledMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export const trustpilotScraper: Scraper = {
  matches(url: string): boolean {
    try {
      return new URL(url).hostname.replace(/^www\./, '') === 'trustpilot.com';
    } catch {
      return false;
    }
  },

  async scrape(url: string, cap = REVIEW_CAP, onProgress?: ProgressCallback): Promise<ScrapeResult> {
    const sourceUrl = url.split('?')[0];
    onProgress?.({ type: 'navigating', source: 'Trustpilot' });
    try {
      return await scrapeWithPlaywright(sourceUrl, cap, onProgress);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      console.error('[trustpilot] Playwright failed, falling back to fetch:', err);
      return await scrapeWithFetch(sourceUrl, cap, onProgress);
    }
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractReviews(pageReviews: any[], cap: number, collected: number): ScrapeResult['reviews'] {
  const reviews: ScrapeResult['reviews'] = [];
  for (const r of pageReviews) {
    if (collected + reviews.length >= cap) break;
    const text = (r.text ?? r.content ?? '').trim();
    if (!text) continue;
    reviews.push({
      author: r.consumer?.displayName?.trim() || undefined,
      rating: typeof r.rating === 'number' ? r.rating : null,
      date: r.createdAt
        ? new Date(r.createdAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      text,
      verified: r.isVerified === true || r.labels?.verification?.isVerified === true,
      sourceReviewId: r.id || undefined,
      sourceUrl: r.id ? `https://www.trustpilot.com/reviews/${r.id}` : undefined,
    });
  }
  return reviews;
}

async function scrapeWithPlaywright(sourceUrl: string, cap: number, onProgress?: ProgressCallback): Promise<ScrapeResult> {
  const { chromium } = await import('playwright-core');

  const fs = await import('fs');
  const executablePath = CHROME_PATHS.find(p => fs.existsSync(p));
  if (!executablePath) throw new Error('No Chrome found for Playwright');

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function fetchPlaywrightPage(pageNum: number, totalPages: number): Promise<any> {
    const page = await browser.newPage();
    onProgress?.({ type: 'page-start', pageNum, totalPages });
    try {
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      });
      await page.goto(`${sourceUrl}?page=${pageNum}`, { waitUntil: 'load', timeout: 30_000 });
      await page.waitForSelector('#__NEXT_DATA__', { timeout: 10_000 }).catch(() => {});
      const nextData = await page.evaluate(() => {
        const el = document.getElementById('__NEXT_DATA__');
        if (!el) return null;
        try { return JSON.parse(el.textContent ?? ''); } catch { return null; }
      });
      return nextData?.props?.pageProps ?? {};
    } finally {
      await page.close();
    }
  }

  try {
    const page1Props = await fetchPlaywrightPage(1, 1);
    const subjectName =
      page1Props.businessUnit?.displayName ||
      page1Props.businessUnit?.identifyingName ||
      new URL(sourceUrl).pathname.replace('/review/', '').replace(/\//g, '');

    const page1Reviews = page1Props.reviews ?? page1Props.reviewsFromLocations ?? [];
    if (!page1Reviews.length) {
      throw new ScraperError('Trustpilot: no reviews found. Try file upload instead.');
    }

    const reviewsPerPage = page1Reviews.length;
    const totalPages: number = page1Props.pagination?.totalPages ?? page1Props.filters?.pagination?.totalPages ?? 1;
    const pagesNeeded = Math.min(Math.ceil(cap / reviewsPerPage), totalPages);

    const reviews = extractReviews(page1Reviews, cap, 0);
    onProgress?.({ type: 'page-done', pageNum: 1, totalPages: pagesNeeded, reviewCount: reviews.length });

    if (pagesNeeded > 1) {
      const remainingPageNums = Array.from({ length: pagesNeeded - 1 }, (_, i) => i + 2);
      // 3 concurrent tabs — safe for Render free (512 MB); was unbounded Promise.all → OOM at cap=500
      const pageResults = await pooledMap(
        remainingPageNums,
        async (pageNum) => {
          const props = await fetchPlaywrightPage(pageNum, pagesNeeded);
          const pageReviews = props.reviews ?? props.reviewsFromLocations ?? [];
          const extracted = extractReviews(pageReviews, cap, reviews.length);
          onProgress?.({ type: 'page-done', pageNum, totalPages: pagesNeeded, reviewCount: extracted.length });
          return extracted;
        },
        3
      );

      for (const batch of pageResults) {
        if (reviews.length >= cap) break;
        reviews.push(...batch.slice(0, cap - reviews.length));
      }
    }

    if (reviews.length === 0) {
      throw new ScraperError('Trustpilot: no reviews found. Try file upload instead.');
    }
    return { subjectName, sourceUrl, reviews };
  } finally {
    await browser.close();
  }
}

async function scrapeWithFetch(sourceUrl: string, cap: number, onProgress?: ProgressCallback): Promise<ScrapeResult> {
  onProgress?.({ type: 'page-start', pageNum: 1, totalPages: 1 });
  const page1Html = await fetchHtml(`${sourceUrl}?page=1`);
  const page1Props = extractNextData(page1Html);

  const subjectName =
    page1Props.businessUnit?.displayName ||
    page1Props.businessUnit?.identifyingName ||
    new URL(sourceUrl).pathname.replace('/review/', '').replace(/\//g, '');

  const page1Reviews = page1Props.reviews ?? page1Props.reviewsFromLocations ?? [];
  if (!page1Reviews.length) {
    throw new ScraperError('Trustpilot: bot detection blocked the request. Try file upload instead.');
  }

  const reviewsPerPage = page1Reviews.length;
  const totalPages: number = page1Props.pagination?.totalPages ?? page1Props.filters?.pagination?.totalPages ?? 1;
  const pagesNeeded = Math.min(Math.ceil(cap / reviewsPerPage), totalPages);

  const reviews = extractReviews(page1Reviews, cap, 0);
  onProgress?.({ type: 'page-done', pageNum: 1, totalPages: pagesNeeded, reviewCount: reviews.length });

  if (pagesNeeded > 1) {
    const remainingPageNums = Array.from({ length: pagesNeeded - 1 }, (_, i) => i + 2);
    // 5 concurrent fetches — lighter than Playwright so can afford slightly more concurrency
    const pageResults = await pooledMap(
      remainingPageNums,
      async (pageNum) => {
        onProgress?.({ type: 'page-start', pageNum, totalPages: pagesNeeded });
        const html = await fetchHtml(`${sourceUrl}?page=${pageNum}`);
        const props = extractNextData(html);
        const pageReviews = props.reviews ?? props.reviewsFromLocations ?? [];
        const extracted = extractReviews(pageReviews, cap, reviews.length);
        onProgress?.({ type: 'page-done', pageNum, totalPages: pagesNeeded, reviewCount: extracted.length });
        return extracted;
      },
      5
    );

    for (const batch of pageResults) {
      if (reviews.length >= cap) break;
      reviews.push(...batch.slice(0, cap - reviews.length));
    }
  }

  if (reviews.length === 0) {
    throw new ScraperError('Trustpilot: bot detection blocked the request. Try file upload instead.');
  }
  return { subjectName, sourceUrl, reviews };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractNextData(html: string): any {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return {};
  try { return JSON.parse(match[1])?.props?.pageProps ?? {}; } catch { return {}; }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new ScraperError(`Trustpilot fetch failed: HTTP ${res.status}`);
  return res.text();
}
