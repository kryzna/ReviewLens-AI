import type { Scraper, ScrapeResult, ProgressCallback } from '@/lib/types';
import { ScraperError } from '@/lib/types';

const REVIEWS_PER_PAGE = 25;
const ANTI_BOT_MSG = "Unable to extract reviews due to Capterra's anti-bot policy. Try file upload instead.";

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
];

export const capterraScraper: Scraper = {
  matches(url: string): boolean {
    try {
      const { hostname, pathname } = new URL(url);
      const host = hostname.replace(/^www\./, '');
      if (host !== 'capterra.com') return false;
      return pathname.startsWith('/p/') || pathname.startsWith('/software/');
    } catch {
      return false;
    }
  },

  async scrape(url: string, cap = 500, onProgress?: ProgressCallback): Promise<ScrapeResult> {
    const sourceUrl = canonicalise(url);
    onProgress?.({ type: 'navigating', source: 'Capterra' });
    return scrapeWithPlaywright(sourceUrl, cap, onProgress);
  },
};

function canonicalise(url: string): string {
  const u = new URL(url);
  let path = u.pathname.replace(/\/$/, '');
  // /software/{id}/{slug} → /p/{id}/{slug}
  path = path.replace(/^\/software\//, '/p/');
  // ensure /reviews/ suffix
  if (!path.endsWith('/reviews')) path += '/reviews';
  return `https://www.capterra.com${path}/`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractReviews(jsonLdReviews: any[], dates: string[], sourceUrl: string, cap: number, collected: number): ScrapeResult['reviews'] {
  const reviews: ScrapeResult['reviews'] = [];
  for (let i = 0; i < jsonLdReviews.length; i++) {
    if (collected + reviews.length >= cap) break;
    const r = jsonLdReviews[i];
    const text = (r.reviewBody ?? '').trim();
    if (!text) continue;
    const rawDate = dates[i] ?? '';
    const parsedDate = parseDate(rawDate);
    reviews.push({
      author: r.author?.name?.trim() || undefined,
      rating: typeof r.reviewRating?.ratingValue === 'number' ? r.reviewRating.ratingValue : null,
      date: parsedDate ?? new Date().toISOString().split('T')[0],
      text,
      verified: true,
      sourceUrl,
    });
  }
  return reviews;
}

function parseDate(str: string): string | null {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

async function scrapeWithPlaywright(sourceUrl: string, cap: number, onProgress?: ProgressCallback): Promise<ScrapeResult> {
  const { chromium } = await import('playwright-extra');
  const StealthPlugin = await import('puppeteer-extra-plugin-stealth');
  chromium.use((StealthPlugin.default ?? StealthPlugin)());
  const fs = await import('fs');

  const executablePath = CHROME_PATHS.find(p => fs.existsSync(p));
  if (!executablePath) throw new Error('No Chrome found for Playwright');

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function fetchPage(pageNum: number, totalPages: number): Promise<{ jsonLd: any | null; dates: string[] }> {
    const page = await browser.newPage();
    onProgress?.({ type: 'page-start', pageNum, totalPages });
    try {
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      });
      const pageUrl = pageNum === 1 ? sourceUrl : `${sourceUrl}?page=${pageNum}`;
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      // Cloudflare challenges each request; wait up to 30s for challenge to clear
      await page.waitForFunction(
        () => !document.title.includes('Just a moment'),
        { timeout: 30_000 }
      ).catch(() => {});
      await page.waitForTimeout(5_000);

      const jsonLd = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const s of scripts) {
          try {
            const data = JSON.parse(s.textContent ?? '');
            if (data['@type'] === 'SoftwareApplication') return data;
          } catch { /* skip */ }
        }
        return null;
      });

      const dates = await page.evaluate(() =>
        Array.from(document.querySelectorAll('div.typo-0.text-neutral-90')).map(el => el.textContent?.trim() ?? '')
      );

      return { jsonLd, dates };
    } finally {
      await page.close();
    }
  }

  try {
    const { jsonLd: page1ld, dates: page1Dates } = await fetchPage(1, 1);

    if (!page1ld) throw new ScraperError(ANTI_BOT_MSG);

    const subjectName: string = page1ld.name ?? 'Unknown';
    const reviewCount: number = page1ld.aggregateRating?.reviewCount ?? cap;
    const perPage = page1ld.review?.length ?? REVIEWS_PER_PAGE;
    const maxPagesByCount = Math.ceil(reviewCount / perPage);
    const totalPages = Math.min(Math.ceil(cap / perPage), maxPagesByCount);

    const reviews = extractReviews(page1ld.review ?? [], page1Dates, sourceUrl, cap, 0);
    onProgress?.({ type: 'page-done', pageNum: 1, totalPages, reviewCount: reviews.length });

    if (totalPages > 1) {
      for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
        if (reviews.length >= cap) break;
        const { jsonLd, dates } = await fetchPage(pageNum, totalPages);
        const extracted = extractReviews(jsonLd?.review ?? [], dates, sourceUrl, cap, reviews.length);
        onProgress?.({ type: 'page-done', pageNum, totalPages, reviewCount: extracted.length });
        reviews.push(...extracted.slice(0, cap - reviews.length));
      }
    }

    if (reviews.length === 0) throw new ScraperError(ANTI_BOT_MSG);
    return { subjectName, sourceUrl, reviews };
  } finally {
    await browser.close();
  }
}
