import type { Scraper, ScrapeResult, ProgressCallback } from '@/lib/types';
import { ScraperError } from '@/lib/types';

export const googlePlayScraper: Scraper = {
  matches(url: string): boolean {
    try {
      const { hostname, pathname } = new URL(url);
      return (
        hostname.replace(/^www\./, '') === 'play.google.com' &&
        pathname.startsWith('/store/apps/details')
      );
    } catch {
      return false;
    }
  },

  async scrape(url: string, cap = 500, onProgress?: ProgressCallback): Promise<ScrapeResult> {
    const { searchParams } = new URL(url);
    const appId = searchParams.get('id');
    if (!appId) throw new ScraperError('Google Play: could not extract app ID from URL.');
    onProgress?.({ type: 'navigating', source: 'Google Play' });

    const country = searchParams.get('gl') ?? 'us';
    const lang = searchParams.get('hl') ?? 'en';

    let gplay: typeof import('google-play-scraper');
    try {
      gplay = await import('google-play-scraper');
    } catch {
      throw new ScraperError(
        'Google Play scraper unavailable. Use file upload instead.'
      );
    }

    let appName = appId;
    try {
      const appInfo = await (gplay.default ?? gplay).app({ appId, country, lang });
      appName = appInfo.title ?? appId;
    } catch {
      // non-fatal — continue without app name
    }

    let rawReviews: Record<string, unknown>[];
    try {
      const result = await (gplay.default ?? gplay).reviews({
        appId,
        country,
        lang,
        sort: ((gplay.default ?? gplay).sort as unknown as Record<string, number>).NEWEST ?? 2,
        num: Math.min(cap, 500),
      });
      rawReviews = (Array.isArray(result) ? result : result.data ?? []) as Record<string, unknown>[];
    } catch (err) {
      throw new ScraperError(
        `Google Play: failed to fetch reviews — ${(err as Error).message}. Use file upload instead.`
      );
    }

    const reviews: ScrapeResult['reviews'] = rawReviews.map(r => ({
      sourceReviewId: String(r.id ?? ''),
      author: String(r.userName ?? '').trim() || undefined,
      rating: typeof r.score === 'number' ? r.score : null,
      date: (() => {
        const dt = r.date instanceof Date ? r.date : new Date(String(r.date ?? ''));
        return isNaN(dt.getTime()) ? new Date().toISOString().split('T')[0] : dt.toISOString().split('T')[0];
      })(),
      text: String(r.text ?? '').trim(),
      verified: false,
      sourceUrl: `https://play.google.com/store/apps/details?id=${appId}`,
      extra: {
        thumbsUp: r.thumbsUp,
        ...(r.replyText ? { devReply: { text: r.replyText, date: r.replyDate } } : {}),
      },
    })).filter(r => r.text.length > 0);

    onProgress?.({ type: 'extracting', count: reviews.length, cap });

    if (reviews.length === 0) {
      throw new ScraperError('Google Play: no reviews found.');
    }

    return { subjectName: appName, sourceUrl: url, reviews };
  },
};
