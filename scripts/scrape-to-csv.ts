import { trustpilotScraper } from '../lib/scrapers/trustpilot';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const url = process.argv[2] ?? 'https://www.trustpilot.com/review/www.amazon.com';
const cap = parseInt(process.argv[3] ?? '50', 10);
const out = process.argv[4] ?? 'reviews.csv';

function escapeCsv(val: string | undefined | null): string {
  if (val == null) return '';
  const s = String(val);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

(async () => {
  console.log(`Scraping ${url} (cap=${cap})…`);
  const result = await trustpilotScraper.scrape(url, cap);
  console.log(`Got ${result.reviews.length} reviews for "${result.subjectName}"`);

  const header = 'author,rating,date,text,source_url,verified';
  const rows = result.reviews.map(r =>
    [
      escapeCsv(r.author),
      r.rating ?? '',
      escapeCsv(r.date),
      escapeCsv(r.text),
      escapeCsv(r.sourceUrl),
      r.verified,
    ].join(',')
  );

  const csv = [header, ...rows].join('\n');
  const outPath = resolve(out);
  writeFileSync(outPath, csv, 'utf-8');
  console.log(`Saved → ${outPath}`);
})();
