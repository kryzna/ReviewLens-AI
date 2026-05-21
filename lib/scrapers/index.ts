import type { Scraper, ScrapeResult, ProgressCallback } from '@/lib/types';
import { ScraperError } from '@/lib/types';
import { trustpilotScraper } from './trustpilot';
import { appStoreScraper } from './appstore';
import { googlePlayScraper } from './googleplay';
import { capterraScraper } from './capterra';
import { g2Scraper } from './g2';

// appStoreScraper excluded — Apple's review API is unavailable for third-party access
const scrapers: Scraper[] = [trustpilotScraper, googlePlayScraper, capterraScraper, g2Scraper];

export function findScraper(url: string): Scraper {
  const scraper = scrapers.find(s => s.matches(url));
  if (!scraper) {
    throw new ScraperError(
      `No scraper available for this URL. Supported: Trustpilot, Capterra, G2, Google Play. Use file upload for other sources.`
    );
  }
  return scraper;
}

export async function scrapeUrl(url: string, cap = 500, onProgress?: ProgressCallback): Promise<ScrapeResult> {
  const scraper = findScraper(url);
  return scraper.scrape(url, cap, onProgress);
}
