import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { scrapeUrl, findScraper } from '@/lib/scrapers/index';
import { computeAggregates } from '@/lib/ingest/normalize';
import { insertSession, insertReviews, getAllReviews, saveInsightBrief } from '@/lib/db/repo';
import { generateInsight } from '@/lib/llm/insight';
import { ScraperError, type Source } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const capParam = req.nextUrl.searchParams.get('cap');
  const cap = Math.min(500, Math.max(1, parseInt(capParam ?? '50') || 50));

  if (!url) {
    return new Response('url param required', { status: 400 });
  }

  try {
    findScraper(url); // validate before opening stream
  } catch (err) {
    return new Response((err as Error).message, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        let source: Source = 'trustpilot';
        if (url.includes('apps.apple.com')) source = 'appstore';
        else if (url.includes('play.google.com')) source = 'googleplay';
        else if (url.includes('capterra.com')) source = 'capterra';

        const result = await scrapeUrl(url, cap, (evt) => {
          if (evt.type === 'navigating') {
            send('navigating', { message: `Navigating to ${evt.source}…` });
          } else if (evt.type === 'page-start') {
            send('page-start', { pageNum: evt.pageNum, totalPages: evt.totalPages });
          } else if (evt.type === 'page-done') {
            send('page-done', { pageNum: evt.pageNum, totalPages: evt.totalPages, reviewCount: evt.reviewCount });
          } else if (evt.type === 'extracting') {
            send('extracting', { count: evt.count, cap: evt.cap });
          }
        });

        send('saving', { message: 'Saving to database…' });

        const aggregates = computeAggregates(result);
        const sessionId = uuidv4();
        const session = await insertSession({
          id: sessionId,
          source,
          sourceUrl: result.sourceUrl || undefined,
          requestedCap: cap,
          subjectName: result.subjectName,
          ingestedAt: new Date().toISOString(),
          ...aggregates,
        });
        await insertReviews(sessionId, result.reviews);

        // Pre-warm insight cache so session page loads instantly
        getAllReviews(sessionId).then(reviews => generateInsight(reviews)).then(brief => saveInsightBrief(sessionId, brief)).catch(() => {});

        send('done', { sessionId: session.id, count: result.reviews.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[stream] ingest error:', msg);
        send('error', { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
