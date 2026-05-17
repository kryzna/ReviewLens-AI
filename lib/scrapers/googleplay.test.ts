import { googlePlayScraper } from './googleplay';

const mockGplay = {
  app: jest.fn().mockResolvedValue({ title: 'Test App' }),
  reviews: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'review1',
        userName: 'Alice',
        score: 5,
        date: new Date('2024-03-01'),
        text: 'Great app!',
        thumbsUp: 10,
        replyText: null,
      },
    ],
  }),
  sort: { NEWEST: 2 },
};

jest.mock('google-play-scraper', () => ({ ...mockGplay, default: mockGplay }));

describe('googlePlayScraper.matches', () => {
  it('matches play.google.com app detail URLs', () => {
    expect(googlePlayScraper.matches('https://play.google.com/store/apps/details?id=com.slack')).toBe(true);
  });
  it('rejects other URLs', () => {
    expect(googlePlayScraper.matches('https://apps.apple.com/us/app/slack/id618783545')).toBe(false);
  });
});

describe('googlePlayScraper.scrape', () => {
  it('maps fields correctly', async () => {
    const result = await googlePlayScraper.scrape(
      'https://play.google.com/store/apps/details?id=com.test',
      10
    );
    expect(result.subjectName).toBe('Test App');
    expect(result.reviews).toHaveLength(1);
    const r = result.reviews[0];
    expect(r.author).toBe('Alice');
    expect(r.rating).toBe(5);
    expect(r.text).toBe('Great app!');
    expect((r.extra as Record<string, unknown>)?.thumbsUp).toBe(10);
  });
});
