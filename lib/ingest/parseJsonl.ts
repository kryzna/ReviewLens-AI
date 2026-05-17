import { z } from 'zod';
import type { ScrapeResult } from '@/lib/types';
import { IngestError } from '@/lib/types';

const RowSchema = z.object({
  author: z.string().optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
  date: z.string().min(1),
  text: z.string().min(1),
  source_url: z.string().optional(),
  verified: z.boolean().optional(),
});

export function parseJsonl(buffer: Buffer, filename: string): ScrapeResult {
  const lines = buffer.toString('utf8').split('\n').filter(l => l.trim());
  const reviews: ScrapeResult['reviews'] = [];
  const rowErrors: { row: number; error: string }[] = [];

  for (let i = 0; i < Math.min(lines.length, 500); i++) {
    let obj: unknown;
    try {
      obj = JSON.parse(lines[i]);
    } catch {
      rowErrors.push({ row: i + 1, error: 'Invalid JSON' });
      continue;
    }
    const parsed = RowSchema.safeParse(obj);
    if (!parsed.success) {
      rowErrors.push({ row: i + 1, error: parsed.error.issues.map(e => e.message).join('; ') });
      continue;
    }
    const d = parsed.data;
    reviews.push({
      author: d.author?.trim() || undefined,
      rating: d.rating ?? null,
      date: new Date(d.date).toISOString().split('T')[0],
      text: d.text,
      sourceUrl: d.source_url || undefined,
      verified: d.verified ?? false,
    });
  }

  if (rowErrors.length > 0 && reviews.length === 0) {
    throw new IngestError('All rows failed validation.', rowErrors);
  }

  const subjectName = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim() || 'Uploaded Reviews';
  return { subjectName, sourceUrl: '', reviews };
}
