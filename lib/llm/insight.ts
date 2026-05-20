import type { Review, InsightBrief } from '@/lib/types';
import { getClient, MODEL } from './client';

const PROMPT = `You are a product review analyst. Analyze the provided reviews and return ONLY a JSON object with this exact structure (no markdown fences, no preamble, no trailing text):
{
  "sentiment": "<positive|mostly positive|mixed|mostly negative|negative>",
  "score": <float 1.0-5.0>,
  "summary": "<one sentence describing overall customer sentiment>",
  "themes": [
    { "title": "<theme name>", "description": "<1-2 sentence description>", "quote": "<exact verbatim substring from a review>" },
    { "title": "<theme name>", "description": "<1-2 sentence description>", "quote": "<exact verbatim substring from a review>" },
    { "title": "<theme name>", "description": "<1-2 sentence description>", "quote": "<exact verbatim substring from a review>" }
  ]
}
Rules:
- themes: exactly 3, ordered by frequency/importance
- quote: must be a verbatim substring (≤100 chars) from one of the provided reviews
- score: weighted average of star ratings if available, otherwise 3.0
- Return raw JSON only — no backticks, no "json" label`;

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
}

export async function generateInsight(reviews: Review[]): Promise<InsightBrief> {
  const client = getClient();
  const reviewLines = reviews.slice(0, 200).map((r, i) => {
    const rating = r.rating !== null ? `${r.rating}★` : 'unrated';
    return `${i + 1}. (${rating}) ${r.text}`;
  }).join('\n');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: 'user', content: `${PROMPT}\n\nREVIEWS:\n${reviewLines}` }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';
  return JSON.parse(stripFences(raw)) as InsightBrief;
}
