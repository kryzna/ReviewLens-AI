import { NextRequest, NextResponse } from 'next/server';
import { getSession, getReviews } from '@/lib/db/repo';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });

  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

  const reviews = await getReviews(id, offset, Math.min(limit, 100));
  return NextResponse.json({ session, reviews });
}
