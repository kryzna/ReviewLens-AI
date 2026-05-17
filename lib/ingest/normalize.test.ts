import { computeAggregates } from './normalize';
import type { ScrapeResult } from '@/lib/types';

const base: ScrapeResult = {
  subjectName: 'Test',
  sourceUrl: '',
  reviews: [
    { rating: 5, date: '2024-01-01', text: 'Great', verified: true },
    { rating: 4, date: '2024-03-01', text: 'Good', verified: false },
    { rating: 1, date: '2024-02-01', text: 'Bad', verified: true },
    { rating: null, date: '2024-04-01', text: 'No rating', verified: false },
  ],
};

describe('computeAggregates', () => {
  const agg = computeAggregates(base);

  it('counts reviews', () => expect(agg.reviewCount).toBe(4));
  it('counts verified', () => expect(agg.verifiedCount).toBe(2));
  it('computes dateMin/Max', () => {
    expect(agg.dateMin).toBe('2024-01-01');
    expect(agg.dateMax).toBe('2024-04-01');
  });
  it('computes ratingAvg from rated reviews only', () => {
    // (5+4+1)/3 = 3.3
    expect(agg.ratingAvg).toBe(3.3);
  });
  it('populates ratingDist', () => {
    expect(agg.ratingDist['5']).toBe(1);
    expect(agg.ratingDist['4']).toBe(1);
    expect(agg.ratingDist['1']).toBe(1);
    expect(agg.ratingDist['2']).toBe(0);
  });
  it('handles all-null ratings', () => {
    const noRatings = computeAggregates({ ...base, reviews: [{ rating: null, date: '2024-01-01', text: 'x', verified: false }] });
    expect(noRatings.ratingAvg).toBeNull();
  });
});
