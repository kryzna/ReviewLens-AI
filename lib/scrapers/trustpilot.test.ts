import { trustpilotScraper } from './trustpilot';
import { ScraperError } from '@/lib/types';

describe('trustpilotScraper.matches', () => {
  it('matches trustpilot.com review URLs', () => {
    expect(trustpilotScraper.matches('https://www.trustpilot.com/review/example.com')).toBe(true);
    expect(trustpilotScraper.matches('https://trustpilot.com/review/example.com')).toBe(true);
  });
  it('rejects non-trustpilot URLs', () => {
    expect(trustpilotScraper.matches('https://g2.com/products/example')).toBe(false);
    expect(trustpilotScraper.matches('https://apps.apple.com/us/app/x/id123')).toBe(false);
  });
});

// Run with: npx jest trustpilot --testNamePattern="@integration"
// Requires Chrome + network access. Skip in unit-only CI.
describe('trustpilotScraper.scrape @integration', () => {
  const TEST_URL = 'https://www.trustpilot.com/review/www.amazon.com';

  jest.setTimeout(120_000);

  it('T1: returns non-empty reviews with correct sourceUrl', async () => {
    const result = await trustpilotScraper.scrape(TEST_URL, 5);
    expect(result.subjectName).toBeTruthy();
    expect(result.reviews.length).toBeGreaterThanOrEqual(1);
    expect(result.sourceUrl).toBe(TEST_URL);
  });

  it('T2: maps all review fields correctly', async () => {
    const result = await trustpilotScraper.scrape(TEST_URL, 1);
    const r = result.reviews[0];
    expect(typeof r.text).toBe('string');
    expect(r.text.length).toBeGreaterThan(0);
    expect(
      r.rating === null || (typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5)
    ).toBe(true);
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof r.verified).toBe('boolean');
    if (r.author !== undefined) expect(typeof r.author).toBe('string');
    if (r.sourceReviewId !== undefined) expect(typeof r.sourceReviewId).toBe('string');
    if (r.sourceUrl !== undefined) expect(r.sourceUrl).toMatch(/trustpilot\.com/);
  });

  it('T3: cap=3 returns exactly 3 reviews', async () => {
    const result = await trustpilotScraper.scrape(TEST_URL, 3);
    expect(result.reviews.length).toBe(3);
  });

  it('T4: cap=25 returns 25 reviews (forces page 2)', async () => {
    const result = await trustpilotScraper.scrape(TEST_URL, 25);
    expect(result.reviews.length).toBe(25);
  });

  it('T5: nonexistent product URL throws ScraperError', async () => {
    await expect(
      trustpilotScraper.scrape('https://www.trustpilot.com/review/__nonexistent__xyz__', 10)
    ).rejects.toThrow(ScraperError);
  });
});
