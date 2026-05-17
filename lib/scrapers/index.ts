import type { Scraper, ScrapeResult } from '@/lib/types';
import { ScraperError } from '@/lib/types';
import { trustpilotScraper } from './trustpilot';
import { appStoreScraper } from './appstore';
import { googlePlayScraper } from './googleplay';

const scrapers: Scraper[] = [trustpilotScraper, appStoreScraper, googlePlayScraper];

export function findScraper(url: string): Scraper {
  const scraper = scrapers.find(s => s.matches(url));
  if (!scraper) {
    throw new ScraperError(
      `No scraper available for this URL. Supported: Trustpilot, Apple App Store, Google Play. Use file upload for other sources.`
    );
  }
  return scraper;
}

export async function scrapeUrl(url: string, cap = 500): Promise<ScrapeResult> {
  const scraper = findScraper(url);
  return scraper.scrape(url, cap);
}
