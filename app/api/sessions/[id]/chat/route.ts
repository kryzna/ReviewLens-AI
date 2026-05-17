import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAllReviews, getMessages, insertMessage } from '@/lib/db/repo';
import { sendMessage } from '@/lib/llm/chat';
import { preCheck, PreCheckError } from '@/lib/guard/preCheck';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });

  const body = await req.json() as { content?: string };
  const content = body.content ?? '';

  try {
    preCheck(content);
  } catch (err) {
    if (err instanceof PreCheckError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const reviews = getAllReviews(id);
  const history = getMessages(id);

  const now = new Date().toISOString();
  const userMsg = insertMessage({ sessionId: id, role: 'user', content, citations: [], createdAt: now });

  try {
    const { content: replyContent, citations } = await sendMessage(content, session, reviews, history);
    const assistantMsg = insertMessage({
      sessionId: id,
      role: 'assistant',
      content: replyContent,
      citations,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ message: assistantMsg });
  } catch (err) {
    console.error('LLM error:', err);
    return NextResponse.json({ error: 'Failed to get a response. Please try again.' }, { status: 500 });
  }
}
