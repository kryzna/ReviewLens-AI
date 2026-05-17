import type { Message, Session, Review } from '@/lib/types';
import { getClient, MODEL, MAX_TOKENS } from './client';
import { buildSystemPrompt } from './prompt';
import { parseCitations } from './citations';

const HISTORY_CHAR_BUDGET = 40_000;

export async function sendMessage(
  userContent: string,
  session: Session,
  reviews: Review[],
  history: Message[]
): Promise<{ content: string; citations: string[] }> {
  const system = buildSystemPrompt(session, reviews);

  // Trim oldest turns if history is too large
  let trimmedHistory = history;
  const historyChars = history.reduce((n, m) => n + m.content.length, 0);
  if (historyChars > HISTORY_CHAR_BUDGET) {
    // Drop oldest pairs until under budget
    trimmedHistory = [...history];
    while (
      trimmedHistory.reduce((n, m) => n + m.content.length, 0) > HISTORY_CHAR_BUDGET &&
      trimmedHistory.length >= 2
    ) {
      trimmedHistory.splice(0, 2);
    }
  }

  const messages = [
    ...trimmedHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userContent },
  ];

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    system,
    messages,
    max_tokens: MAX_TOKENS,
  });

  const content = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  return { content, citations: parseCitations(content) };
}
