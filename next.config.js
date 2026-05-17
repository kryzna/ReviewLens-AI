/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'google-play-scraper', 'playwright-core'],
  outputFileTracingRoot: __dirname,
};

module.exports = nextConfig;
