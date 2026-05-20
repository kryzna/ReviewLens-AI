import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAllReviews } from '@/lib/db/repo';
import { generateInsight } from '@/lib/llm/insight';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const reviews = await getAllReviews(id);
  try {
    const brief = await generateInsight(reviews);
    return NextResponse.json(brief);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
