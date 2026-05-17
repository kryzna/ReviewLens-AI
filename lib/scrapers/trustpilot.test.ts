import { trustpilotScraper } from './trustpilot';

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
