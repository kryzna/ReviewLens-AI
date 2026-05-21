import type { Scraper, ScrapeResult, ProgressCallback } from '@/lib/types';
import { ScraperError } from '@/lib/types';

const REVIEWS_PER_PAGE = 25;
const ANTI_BOT_MSG = "Unable to extract G2 reviews due to bot protection. Try file upload instead.";

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

export const g2Scraper: Scraper = {
  matches(url: string): boolean {
    try {
      const { hostname, pathname } = new URL(url);
      const host = hostname.replace(/^www\./, '');
      return host === 'g2.com' && pathname.startsWith('/products/');
    } catch {
      return false;
    }
  },

  async scrape(url: string, cap = 500, onProgress?: ProgressCallback): Promise<ScrapeResult> {
    const sourceUrl = canonicalise(url);
    onProgress?.({ type: 'navigating', source: 'G2' });
    try {
      return await scrapeWithPlaywright(sourceUrl, cap, onProgress);
    } catch (err) {
      if (err instanceof ScraperError) {
        console.error('[g2] Playwright blocked, falling back to fetch:', err.message);
        return await scrapeWithFetch(sourceUrl, cap, onProgress);
      }
      throw err;
    }
  },
};

function canonicalise(url: string): string {
  const u = new URL(url);
  // /products/{slug} or /products/{slug}/reviews → normalise to /products/{slug}/reviews
  let path = u.pathname.replace(/\/$/, '');
  if (!path.endsWith('/reviews')) path += '/reviews';
  return `https://www.g2.com${path}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractReviewsFromDom(domReviews: any[], sourceUrl: string, cap: number, collected: number): ScrapeResult['reviews'] {
  const reviews: ScrapeResult['reviews'] = [];
  for (const r of domReviews) {
    if (collected + reviews.length >= cap) break;
    const text = (r.text ?? '').trim();
    if (!text) continue;
    reviews.push({
      author: r.author || undefined,
      rating: typeof r.rating === 'number' ? r.rating : null,
      date: r.date || new Date().toISOString().split('T')[0],
      text,
      verified: true,
      sourceUrl,
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
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function fetchPage(pageNum: number, totalPages: number): Promise<any[]> {
    const page = await browser.newPage();
    onProgress?.({ type: 'page-start', pageNum, totalPages });
    try {
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      });
      const pageUrl = pageNum === 1 ? sourceUrl : `${sourceUrl}?page=${pageNum}`;
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForFunction(
        () => !document.title.includes('Just a moment'),
        { timeout: 30_000 }
      ).catch(() => {});
      await page.waitForTimeout(4_000);

      // G2 uses schema.org microdata — most stable extraction target
      return await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[itemtype="http://schema.org/Review"]')).map(el => {
          const ratingEl = el.querySelector('[itemprop="ratingValue"]');
          const rating = ratingEl?.getAttribute('content') ?? ratingEl?.textContent?.trim();
          const text = [
            el.querySelector('[itemprop="reviewBody"]')?.textContent?.trim(),
            el.querySelector('.formatted-text')?.textContent?.trim(),
          ].find(Boolean) ?? '';
          const author = el.querySelector('[itemprop="author"] [itemprop="name"]')?.textContent?.trim()
            ?? el.querySelector('.m-0.l2')?.textContent?.trim()
            ?? '';
          const dateEl = el.querySelector('time[datetime]');
          const date = dateEl?.getAttribute('datetime')
            ?? dateEl?.textContent?.trim()
            ?? '';
          return {
            rating: rating ? Math.round(parseFloat(rating)) : null,
            text,
            author,
            date: date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          };
        });
      });
    } finally {
      await page.close();
    }
  }

  try {
    const page1Reviews = await fetchPage(1, 1);
    if (!page1Reviews.length) throw new ScraperError(ANTI_BOT_MSG);

    const subjectName = sourceUrl.match(/\/products\/([^/]+)\//)?.[1]?.replace(/-/g, ' ') ?? 'Unknown';
    const reviewsPerPage = page1Reviews.length;
    const totalPages = Math.min(Math.ceil(cap / reviewsPerPage), 10); // G2 caps pages

    const reviews = extractReviewsFromDom(page1Reviews, sourceUrl, cap, 0);
    onProgress?.({ type: 'page-done', pageNum: 1, totalPages, reviewCount: reviews.length });

    for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
      if (reviews.length >= cap) break;
      await new Promise(r => setTimeout(r, 2000));
      const pageReviews = await fetchPage(pageNum, totalPages);
      const extracted = extractReviewsFromDom(pageReviews, sourceUrl, cap, reviews.length);
      onProgress?.({ type: 'page-done', pageNum, totalPages, reviewCount: extracted.length });
      reviews.push(...extracted.slice(0, cap - reviews.length));
    }

    if (reviews.length === 0) throw new ScraperError(ANTI_BOT_MSG);
    return { subjectName, sourceUrl, reviews };
  } finally {
    await browser.close();
  }
}

async function scrapeWithFetch(sourceUrl: string, cap: number, onProgress?: ProgressCallback): Promise<ScrapeResult> {
  onProgress?.({ type: 'page-start', pageNum: 1, totalPages: 1 });
  const html = await fetchHtml(sourceUrl);
  const domReviews = extractReviewsFromHtml(html);
  if (!domReviews.length) throw new ScraperError(ANTI_BOT_MSG);

  const subjectName = sourceUrl.match(/\/products\/([^/]+)\//)?.[1]?.replace(/-/g, ' ') ?? 'Unknown';
  const totalPages = Math.min(Math.ceil(cap / REVIEWS_PER_PAGE), 10);
  const reviews = extractReviewsFromDom(domReviews, sourceUrl, cap, 0);
  onProgress?.({ type: 'page-done', pageNum: 1, totalPages, reviewCount: reviews.length });

  for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
    if (reviews.length >= cap) break;
    const pageHtml = await fetchHtml(`${sourceUrl}?page=${pageNum}`);
    const pageReviews = extractReviewsFromHtml(pageHtml);
    const extracted = extractReviewsFromDom(pageReviews, sourceUrl, cap, reviews.length);
    onProgress?.({ type: 'page-done', pageNum, totalPages, reviewCount: extracted.length });
    reviews.push(...extracted.slice(0, cap - reviews.length));
  }

  if (reviews.length === 0) throw new ScraperError(ANTI_BOT_MSG);
  return { subjectName, sourceUrl, reviews };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractReviewsFromHtml(html: string): any[] {
  // G2 schema.org microdata — parse from raw HTML via regex
  const reviews: { text: string; author: string; rating: number | null; date: string }[] = [];
  const reviewBlockRe = /itemprop="reviewBody"[^>]*>([\s\S]*?)<\/[a-z]+>/gi;
  const ratingRe = /itemprop="ratingValue"[^>]*content="([^"]+)"/i;
  const authorRe = /itemprop="name"[^>]*>([\s\S]*?)<\/[a-z]+>/i;
  const dateRe = /datetime="([^"]+)"/i;

  // Split by review container markers and extract per review
  const blocks = html.split(/itemtype="http:\/\/schema\.org\/Review"/);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].substring(0, 5000); // limit per block
    const textMatch = reviewBlockRe.exec(block);
    reviewBlockRe.lastIndex = 0;
    const ratingMatch = ratingRe.exec(block);
    const authorMatch = authorRe.exec(block);
    const dateMatch = dateRe.exec(block);

    const text = textMatch?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '';
    if (!text) continue;

    reviews.push({
      text,
      author: authorMatch?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '',
      rating: ratingMatch ? Math.round(parseFloat(ratingMatch[1])) : null,
      date: dateMatch ? new Date(dateMatch[1]).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    });
  }
  return reviews;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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
  if (!res.ok) throw new ScraperError(ANTI_BOT_MSG);
  return res.text();
}
