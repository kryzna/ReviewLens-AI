import { NextRequest, NextResponse } from 'next/server';
import { getSession, getMessages } from '@/lib/db/repo';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });

  const messages = getMessages(id);
  return NextResponse.json({ messages });
}
