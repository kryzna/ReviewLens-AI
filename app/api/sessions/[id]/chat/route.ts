import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAllReviews, getMessages, insertMessage } from '@/lib/db/repo';
import { streamMessage } from '@/lib/llm/chat';
import { preCheck, PreCheckError } from '@/lib/guard/preCheck';

export const dynamic = 'force-dynamic';

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
  insertMessage({ sessionId: id, role: 'user', content, citations: [], createdAt: now });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        const { content: replyContent, citations } = await streamMessage(
          content,
          session,
          reviews,
          history,
          (token) => send('token', { text: token })
        );

        const assistantMsg = insertMessage({
          sessionId: id,
          role: 'assistant',
          content: replyContent,
          citations,
          createdAt: new Date().toISOString(),
        });

        send('done', { message: assistantMsg });
      } catch (err) {
        console.error('LLM error:', err);
        send('error', { message: 'Failed to get a response. Please try again.' });
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
