/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'google-play-scraper', 'app-store-scraper', 'playwright-core', 'playwright-extra', 'playwright-extra-plugin-stealth', 'puppeteer-extra-plugin-stealth', 'puppeteer-extra-plugin', 'merge-deep', 'clone-deep'],
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
