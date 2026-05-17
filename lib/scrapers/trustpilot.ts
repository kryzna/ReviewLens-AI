import type { Scraper, ScrapeResult } from '@/lib/types';
import { ScraperError } from '@/lib/types';

const REVIEW_CAP = 500;
const DELAY_MS = 1500;

// Chrome on macOS/Linux/Windows
const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

export const trustpilotScraper: Scraper = {
  matches(url: string): boolean {
    try {
      return new URL(url).hostname.replace(/^www\./, '') === 'trustpilot.com';
    } catch {
      return false;
    }
  },

  async scrape(url: string, cap = REVIEW_CAP): Promise<ScrapeResult> {
    const sourceUrl = url.split('?')[0];
    // Try Playwright first (bypasses Cloudflare), fall back to plain fetch
    try {
      return await scrapeWithPlaywright(sourceUrl, cap);
    } catch (err) {
      if (err instanceof ScraperError) throw err;
      console.error('[trustpilot] Playwright failed, falling back to fetch:', err);
      return await scrapeWithFetch(sourceUrl, cap);
    }
  },
};

async function scrapeWithPlaywright(sourceUrl: string, cap: number): Promise<ScrapeResult> {
  const { chromium } = await import('playwright-core');

  const fs = await import('fs');
  const executablePath = CHROME_PATHS.find(p => fs.existsSync(p));
  if (!executablePath) throw new Error('No Chrome found for Playwright');

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const ctx = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
    });
    const page = await ctx.newPage();

    const reviews: ScrapeResult['reviews'] = [];
    let subjectName = '';
    let pageNum = 1;

    while (reviews.length < cap) {
      await page.goto(`${sourceUrl}?page=${pageNum}`, { waitUntil: 'load', timeout: 30_000 });
      // Wait for Next.js data script to populate (it's server-rendered, present after load)
      await page.waitForSelector('#__NEXT_DATA__', { timeout: 10_000 }).catch(() => {});

      const nextData = await page.evaluate(() => {
        const el = document.getElementById('__NEXT_DATA__');
        if (!el) return null;
        try { return JSON.parse(el.textContent ?? ''); } catch { return null; }
      });

      const props = nextData?.props?.pageProps ?? {};

      if (pageNum === 1) {
        subjectName =
          props.businessUnit?.displayName ||
          props.businessUnit?.identifyingName ||
          new URL(sourceUrl).pathname.replace('/review/', '').replace(/\//g, '');
      }

      const pageReviews = props.reviews ?? props.reviewsFromLocations ?? [];
      if (!pageReviews.length) break;

      for (const r of pageReviews) {
        if (reviews.length >= cap) break;
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

      const totalPages = props.pagination?.totalPages ?? props.filters?.pagination?.totalPages;
      if (totalPages && pageNum >= totalPages) break;
      pageNum++;
      if (reviews.length < cap) await sleep(DELAY_MS);
    }

    if (reviews.length === 0) {
      throw new ScraperError('Trustpilot: no reviews found. Try file upload instead.');
    }
    return { subjectName, sourceUrl, reviews };
  } finally {
    await browser.close();
  }
}

async function scrapeWithFetch(sourceUrl: string, cap: number): Promise<ScrapeResult> {
  const reviews: ScrapeResult['reviews'] = [];
  let subjectName = '';
  let page = 1;

  while (reviews.length < cap) {
    const html = await fetchHtml(`${sourceUrl}?page=${page}`);
    const props = extractNextData(html);

    if (page === 1) {
      subjectName =
        props.businessUnit?.displayName ||
        props.businessUnit?.identifyingName ||
        new URL(sourceUrl).pathname.replace('/review/', '').replace(/\//g, '');
    }

    const pageReviews = props.reviews ?? props.reviewsFromLocations ?? [];
    if (!pageReviews.length) break;

    for (const r of pageReviews) {
      if (reviews.length >= cap) break;
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

    const totalPages = props.pagination?.totalPages ?? props.filters?.pagination?.totalPages;
    if (totalPages && page >= totalPages) break;
    page++;
    if (reviews.length < cap) await sleep(DELAY_MS);
  }

  if (reviews.length === 0) {
    throw new ScraperError(
      'Trustpilot: bot detection blocked the request. Try file upload instead.'
    );
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
