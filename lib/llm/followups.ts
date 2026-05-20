import { getClient, MODEL } from './client';

const PROMPT = `Based on this product review analysis answer, suggest 2-3 concise follow-up questions a product manager would want to ask next. Return ONLY a JSON array of strings — no markdown, no preamble.
Example: ["Which product areas drive the most 1-star reviews?", "Do verified buyers rate differently than unverified ones?"]`;

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
}

function stripCitations(content: string): string {
  return content.replace(/\[r:[a-f0-9-]{36}\]/g, '').replace(/\s{2,}/g, ' ').trim();
}

export async function generateFollowups(assistantMessage: string): Promise<string[]> {
  const client = getClient();
  const clean = stripCitations(assistantMessage).slice(0, 2000);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [{ role: 'user', content: `${PROMPT}\n\nAnswer:\n${clean}` }],
  });
  const raw = response.content[0].type === 'text' ? response.content[0].text : '[]';
  const parsed: unknown = JSON.parse(stripFences(raw));
  return Array.isArray(parsed) ? (parsed as string[]).slice(0, 3) : [];
}
