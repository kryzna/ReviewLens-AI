import type { Scraper, ScrapeResult } from '@/lib/types';
import { ScraperError } from '@/lib/types';

export const appStoreScraper: Scraper = {
  matches(url: string): boolean {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return host === 'apps.apple.com';
    } catch {
      return false;
    }
  },

  async scrape(url: string, cap = 500): Promise<ScrapeResult> {
    const appIdMatch = url.match(/\/id(\d+)/);
    if (!appIdMatch) throw new ScraperError('App Store: could not extract app ID from URL.');

    const appId = appIdMatch[1];
    const countryMatch = new URL(url).pathname.match(/^\/([a-z]{2})\//);
    const country = countryMatch?.[1] ?? 'us';

    const reviews: ScrapeResult['reviews'] = [];
    let appName = '';

    for (let page = 1; page <= 10 && reviews.length < cap; page++) {
      const rssUrl =
        `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${appId}/sortby=mostrecent/json`;

      const res = await fetch(rssUrl, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new ScraperError(`App Store RSS fetch failed: HTTP ${res.status}`);

      const data = await res.json() as Record<string, unknown>;
      const feed = (data as { feed?: { entry?: unknown[] } }).feed;
      if (!feed?.entry || feed.entry.length === 0) break;

      for (const entry of feed.entry as Record<string, Record<string, unknown>>[]) {
        // First entry is app metadata
        if (entry['im:name'] && !entry['im:rating']) {
          appName = String(entry['im:name'].label ?? '');
          continue;
        }

        if (reviews.length >= cap) break;

        const rating = parseInt(String(entry['im:rating']?.label ?? '0'), 10) || null;
        const date = entry.updated?.label
          ? new Date(String(entry.updated.label)).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        const text = String(entry.content?.label ?? '').trim();
        const author = String((entry.author as Record<string, unknown>)?.name ?? '').trim() || undefined;
        const sourceReviewId = String(entry.id?.label ?? '').split('/').pop() || undefined;

        if (!text) continue;

        reviews.push({ author, rating, date, text, verified: true, sourceReviewId, sourceUrl: url });
      }
    }

    if (reviews.length === 0) {
      throw new ScraperError('App Store: no reviews found for this app.');
    }

    return { subjectName: appName || `App ${appId}`, sourceUrl: url, reviews };
  },
};
