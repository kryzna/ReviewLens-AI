import type { Message, Session, Review } from '@/lib/types';
import { getClient, MODEL, MAX_TOKENS } from './client';
import { buildSystemPrompt } from './prompt';
import { parseCitations } from './citations';

const HISTORY_CHAR_BUDGET = 40_000;

function buildMessages(userContent: string, history: Message[]) {
  let trimmedHistory = history;
  const historyChars = history.reduce((n, m) => n + m.content.length, 0);
  if (historyChars > HISTORY_CHAR_BUDGET) {
    trimmedHistory = [...history];
    while (
      trimmedHistory.reduce((n, m) => n + m.content.length, 0) > HISTORY_CHAR_BUDGET &&
      trimmedHistory.length >= 2
    ) {
      trimmedHistory.splice(0, 2);
    }
  }
  return [
    ...trimmedHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userContent },
  ];
}

export async function streamMessage(
  userContent: string,
  session: Session,
  reviews: Review[],
  history: Message[],
  onToken: (text: string) => void
): Promise<{ content: string; citations: string[] }> {
  const client = getClient();
  const system = buildSystemPrompt(session, reviews);
  const messages = buildMessages(userContent, history);

  let fullContent = '';

  const stream = client.messages.stream({
    model: MODEL,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] as Parameters<typeof client.messages.create>[0]['system'],
    messages,
    max_tokens: MAX_TOKENS,
  }, { headers: { 'anthropic-beta': 'prompt-caching-2024-07-31' } });

  stream.on('text', (text) => {
    onToken(text);
    fullContent += text;
  });

  await stream.finalMessage();

  return { content: fullContent, citations: parseCitations(fullContent) };
}

// Keep non-streaming export for any existing callers
export async function sendMessage(
  userContent: string,
  session: Session,
  reviews: Review[],
  history: Message[]
): Promise<{ content: string; citations: string[] }> {
  let content = '';
  return streamMessage(userContent, session, reviews, history, (t) => { content += t; });
}
