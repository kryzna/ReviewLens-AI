import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/db/repo';
import { generateFollowups } from '@/lib/llm/followups';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as { assistantMessage?: string };
  const msg = body.assistantMessage ?? '';
  try {
    const suggestions = await generateFollowups(msg);
    return NextResponse.json({ suggestions });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
