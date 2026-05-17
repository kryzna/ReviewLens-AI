import { appStoreScraper } from './appstore';

describe('appStoreScraper.matches', () => {
  it('matches apps.apple.com URLs', () => {
    expect(appStoreScraper.matches('https://apps.apple.com/us/app/slack/id618783545')).toBe(true);
  });
  it('rejects other URLs', () => {
    expect(appStoreScraper.matches('https://play.google.com/store/apps/details?id=com.slack')).toBe(false);
  });
});
