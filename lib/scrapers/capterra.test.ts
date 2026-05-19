import { capterraScraper } from './capterra';
import { ScraperError } from '@/lib/types';

const FIXTURE_URL = 'https://www.capterra.com/p/169455/Zoho-Projects/';

describe('capterraScraper @integration', () => {
  jest.setTimeout(120_000);

  test('T1 @integration happy path returns subjectName and reviews', async () => {
    const result = await capterraScraper.scrape(FIXTURE_URL, 25);
    expect(result.subjectName).toBeTruthy();
    expect(result.reviews.length).toBeGreaterThan(0);
  });

  test('T2 @integration field mapping on first review', async () => {
    const result = await capterraScraper.scrape(FIXTURE_URL, 5);
    const r = result.reviews[0];
    expect(typeof r.author === 'string' || r.author === undefined).toBe(true);
    expect(r.rating).not.toBeNull();
    expect(r.rating).toBeGreaterThanOrEqual(1);
    expect(r.rating).toBeLessThanOrEqual(5);
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.verified).toBe(true);
  });

  test('T3 @integration cap=3 returns at most 3 reviews', async () => {
    const result = await capterraScraper.scrape(FIXTURE_URL, 3);
    expect(result.reviews.length).toBeLessThanOrEqual(3);
    expect(result.reviews.length).toBeGreaterThan(0);
  });

  test('T4 @integration cap=30 triggers pagination and returns >=25 reviews', async () => {
    const result = await capterraScraper.scrape(FIXTURE_URL, 30);
    expect(result.reviews.length).toBeGreaterThanOrEqual(25);
  });

  test('T5 @integration invalid URL throws ScraperError', async () => {
    await expect(
      capterraScraper.scrape('https://www.capterra.com/p/000000/nonexistent-product/', 5)
    ).rejects.toThrow(ScraperError);
  });
});
