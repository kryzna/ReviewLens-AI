import type { Scraper, ScrapeResult, ProgressCallback } from '@/lib/types';
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

  async scrape(url: string, cap = 500, onProgress?: ProgressCallback): Promise<ScrapeResult> {
    const appIdMatch = url.match(/\/id(\d+)/);
    if (!appIdMatch) throw new ScraperError('App Store: could not extract app ID from URL.');
    onProgress?.({ type: 'navigating', source: 'App Store' });

    const appId = parseInt(appIdMatch[1], 10);
    const countryMatch = new URL(url).pathname.match(/^\/([a-z]{2})\//);
    const country = countryMatch?.[1] ?? 'us';

    let store: typeof import('app-store-scraper');
    try {
      store = await import('app-store-scraper');
    } catch {
      throw new ScraperError('App Store scraper unavailable. Use file upload instead.');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (store.default ?? store) as any;

    let appName = `App ${appId}`;
    try {
      const info = await api.app({ id: appId, country });
      appName = info.title ?? appName;
    } catch { /* non-fatal */ }

    const reviews: ScrapeResult['reviews'] = [];
    const pages = Math.min(10, Math.ceil(cap / 50));

    for (let page = 1; page <= pages && reviews.length < cap; page++) {
      onProgress?.({ type: 'page-start', pageNum: page, totalPages: pages });
      try {
        const raw = await api.reviews({ id: appId, country, sort: api.sort?.RECENT ?? 2, page });
        if (!raw?.length) break;
        for (const r of raw) {
          if (reviews.length >= cap) break;
          if (!r.text?.trim()) continue;
          reviews.push({
            sourceReviewId: String(r.id ?? ''),
            author: r.userName?.trim() || undefined,
            rating: typeof r.score === 'number' ? r.score : null,
            date: r.date ? new Date(r.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            text: r.text.trim(),
            verified: false,
            sourceUrl: url,
          });
        }
        onProgress?.({ type: 'page-done', pageNum: page, totalPages: pages, reviewCount: reviews.length });
      } catch { break; }
    }

    if (reviews.length === 0) throw new ScraperError('App Store: no reviews found for this app.');
    return { subjectName: appName, sourceUrl: url, reviews };
  },
};
