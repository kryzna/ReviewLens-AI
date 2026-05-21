import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { scrapeUrl, findScraper } from '@/lib/scrapers/index';
import { parseCsv } from '@/lib/ingest/parseCsv';
import { parseJsonl } from '@/lib/ingest/parseJsonl';
import { computeAggregates } from '@/lib/ingest/normalize';
import { insertSession, insertReviews, listSessions, getAllReviews, saveInsightBrief } from '@/lib/db/repo';
import { generateInsight } from '@/lib/llm/insight';
import { ScraperError, IngestError, type Source } from '@/lib/types';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET() {
  try {
    const sessions = await listSessions();
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to list sessions.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { allowed, retryAfterSecs } = checkRateLimit(getClientIp(req));
  if (!allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${retryAfterSecs}s.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSecs) } }
    );
  }

  try {
    const contentType = req.headers.get('content-type') ?? '';

    let result;
    let source: Source = 'upload';
    let fileName: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
      fileName = file.name;

      const buffer = Buffer.from(await file.arrayBuffer());
      const name = file.name.toLowerCase();

      if (name.endsWith('.csv')) {
        result = parseCsv(buffer, file.name);
      } else if (name.endsWith('.jsonl')) {
        result = parseJsonl(buffer, file.name);
      } else {
        return NextResponse.json({ error: 'File must be .csv or .jsonl' }, { status: 400 });
      }
    } else {
      const body = await req.json() as { url?: string };
      if (!body.url) return NextResponse.json({ error: 'url is required.' }, { status: 400 });

      const urlStr = body.url;
      // Detect source from URL before scraping
      if (urlStr.includes('trustpilot.com')) source = 'trustpilot';
      else if (urlStr.includes('apps.apple.com')) source = 'appstore';
      else if (urlStr.includes('play.google.com')) source = 'googleplay';
      else if (urlStr.includes('capterra.com')) source = 'capterra';
      else if (urlStr.includes('g2.com')) source = 'g2';

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      try {
        result = await scrapeUrl(urlStr);
      } finally {
        clearTimeout(timeout);
      }
    }

    const aggregates = computeAggregates(result);
    const sessionId = uuidv4();

    const session = await insertSession({
      id: sessionId,
      source,
      sourceUrl: result.sourceUrl || undefined,
      fileName,
      subjectName: result.subjectName,
      ingestedAt: new Date().toISOString(),
      ...aggregates,
    });

    await insertReviews(sessionId, result.reviews);

    // Pre-warm insight cache so Insight Radar loads instantly on session page
    getAllReviews(sessionId).then(reviews => generateInsight(reviews)).then(brief => saveInsightBrief(sessionId, brief)).catch(() => {});

    return NextResponse.json({ sessionId: session.id }, { status: 201 });
  } catch (err) {
    if (err instanceof ScraperError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof IngestError) {
      return NextResponse.json({ error: err.message, rowErrors: err.rowErrors }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
