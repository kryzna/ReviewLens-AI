import type { ScrapeResult, Session } from '@/lib/types';

type Aggregates = Pick<Session, 'reviewCount' | 'verifiedCount' | 'dateMin' | 'dateMax' | 'ratingAvg' | 'ratingDist'>;

export function computeAggregates(result: ScrapeResult): Aggregates {
  const reviews = result.reviews;
  const dist: Record<'1' | '2' | '3' | '4' | '5', number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let ratingSum = 0;
  let ratingCount = 0;
  let verifiedCount = 0;
  const dates: string[] = [];

  for (const r of reviews) {
    if (r.verified) verifiedCount++;
    if (r.rating !== null && r.rating >= 1 && r.rating <= 5) {
      const key = String(r.rating) as '1' | '2' | '3' | '4' | '5';
      dist[key]++;
      ratingSum += r.rating;
      ratingCount++;
    }
    if (r.date) dates.push(r.date);
  }

  const sortedDates = dates.sort();

  return {
    reviewCount: reviews.length,
    verifiedCount,
    dateMin: sortedDates[0] ?? undefined,
    dateMax: sortedDates[sortedDates.length - 1] ?? undefined,
    ratingAvg: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    ratingDist: dist,
  };
}
