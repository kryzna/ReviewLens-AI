declare module 'puppeteer-extra-plugin-stealth' {
  import type { CompatiblePlugin } from 'playwright-extra';
  function StealthPlugin(): CompatiblePlugin;
  export = StealthPlugin;
}
