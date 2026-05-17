import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import type { ScrapeResult } from '@/lib/types';
import { IngestError } from '@/lib/types';

const RowSchema = z.object({
  author: z.string().optional(),
  rating: z.coerce.number().min(1).max(5).nullable().optional(),
  date: z.string().min(1),
  text: z.string().min(1),
  source_url: z.string().optional(),
  verified: z.union([z.boolean(), z.string()]).optional(),
});

export function parseCsv(buffer: Buffer, filename: string): ScrapeResult {
  let rows: Record<string, string>[];
  try {
    rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch (err) {
    throw new IngestError(`CSV parse error: ${(err as Error).message}`);
  }

  const reviews: ScrapeResult['reviews'] = [];
  const rowErrors: { row: number; error: string }[] = [];

  for (let i = 0; i < Math.min(rows.length, 500); i++) {
    const parsed = RowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      rowErrors.push({ row: i + 2, error: parsed.error.issues.map(e => e.message).join('; ') });
      continue;
    }
    const d = parsed.data;
    reviews.push({
      author: d.author?.trim() || undefined,
      rating: d.rating ?? null,
      date: new Date(d.date).toISOString().split('T')[0],
      text: d.text,
      sourceUrl: d.source_url || undefined,
      verified: d.verified === true || d.verified === 'true' || d.verified === '1',
    });
  }

  if (rowErrors.length > 0 && reviews.length === 0) {
    throw new IngestError(`All rows failed validation.`, rowErrors);
  }

  const subjectName = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim() || 'Uploaded Reviews';
  return { subjectName, sourceUrl: '', reviews };
}
