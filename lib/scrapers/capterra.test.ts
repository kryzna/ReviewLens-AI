import { capterraScraper } from './capterra';
import { ScraperError } from '@/lib/types';

// Each test uses a distinct product URL to avoid Cloudflare rate-limiting
// from rapid repeat requests to the same page.
const URL_T1 = 'https://www.capterra.com/p/169455/Zoho-Projects/';
const URL_T2 = 'https://www.capterra.com/p/135003/Slack/';
const URL_T3 = 'https://www.capterra.com/p/66658/Asana/';
const URL_T4 = 'https://www.capterra.com/p/93423/Trello/';

describe('capterraScraper @integration', () => {
  jest.setTimeout(120_000);

  test('T1 @integration happy path returns subjectName and reviews', async () => {
    const result = await capterraScraper.scrape(URL_T1, 25);
    expect(result.subjectName).toBeTruthy();
    expect(result.reviews.length).toBeGreaterThan(0);
  });

  test('T2 @integration field mapping on first review', async () => {
    const result = await capterraScraper.scrape(URL_T2, 5);
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
    const result = await capterraScraper.scrape(URL_T3, 3);
    expect(result.reviews.length).toBeLessThanOrEqual(3);
    expect(result.reviews.length).toBeGreaterThan(0);
  });

  test('T4 @integration cap=30 triggers pagination and returns >=25 reviews', async () => {
    const result = await capterraScraper.scrape(URL_T4, 30);
    expect(result.reviews.length).toBeGreaterThanOrEqual(25);
  });

  test('T5 @integration invalid URL throws ScraperError', async () => {
    await expect(
      capterraScraper.scrape('https://www.capterra.com/p/000000/nonexistent-product/', 5)
    ).rejects.toThrow(ScraperError);
  });
});
