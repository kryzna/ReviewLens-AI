# Chat Features

AI-powered features in the session chat panel beyond basic Q&A, implemented in [[components/ChatPanel.tsx]].

## Proactive Insight Brief

Fetches `GET /api/sessions/[id]/insight` on session load and renders a collapsible card with sentiment label, star score, summary, and 3 top themes with verbatim quotes — before the user asks anything.

The loading spinner only appears after a **500 ms delay** to avoid flashing on cache hits.

The backend calls [[lib/llm/insight.ts#generateInsight]], which caps input at 200 reviews and requests JSON output (`max_tokens=1200`). Parse errors are caught and suppressed; the card simply does not appear on failure.

The response includes an additive `radar` field (`InsightRadarData`) — 5-6 themes each with a normalized 0-100 score, review count, sentiment label, and top verbatim quote. This powers the `InsightPanel` spider chart. Old cached briefs without `radar` are still valid (field is optional).

Result is persisted in `sessions.insight_brief` (JSON text column). On subsequent loads the cached value is returned immediately — no LLM call. Cache is permanent; re-ingesting creates a new session with no cache.

## Insight Radar

Spider/radar chart rendered on session page load before the user types anything. Powered by the `radar` field in the `/insight` API response.

`[[components/InsightPanel.tsx]]` fetches `/api/sessions/[id]/insight` client-side on mount, extracts `json.radar`, and renders `[[components/InsightRadar.tsx]]` (recharts `RadarChart`) + `[[components/QuoteStream.tsx]]` (rotating quotes). Skeleton shown while in-flight; error falls back to a single line of text.

`[[components/InsightRadar.tsx]]` plots 5-6 theme axes. Each dot is colored by sentiment (green/red/amber). Tooltip shows review count, score, and top verbatim quote. Loaded via `next/dynamic` with `ssr: false` to avoid recharts SSR issues.

`[[components/QuoteStream.tsx]]` cycles through `themes[].topQuote` every 4 seconds with a 400 ms fade transition. Each quote shows a sentiment badge (positive/negative/mixed) and the theme name.

`InsightPanel` is placed in `[[app/session/[id]/page.tsx]]` between `SummaryCard` and `TabsClient`.

The insight cache is pre-warmed at ingest time in both ingestion paths: `[[app/api/sessions/stream/route.ts]]` (URL scrape) and `[[app/api/sessions/route.ts]]` (file upload) both fire `generateInsight` + `saveInsightBrief` in a background promise (no `await`) after `insertReviews`. By the time the user navigates to the session page, `/api/sessions/[id]/insight` hits the cache and returns immediately.

## Session Sidebar

`[[components/SessionSidebar.tsx]]` lists all sessions ordered by `ingested_at DESC`. Each item shows a trash icon on hover; clicking it deletes the session.

Deletion is optimistic: the item is removed from local state immediately, the user is redirected to `/` if the active session was deleted, and `DELETE /api/sessions/[id]` fires in the background. The handler calls `[[lib/db/repo.ts#deleteSession]]` (`DELETE FROM sessions WHERE id = $1`), cascading to `reviews` and `messages` via FK constraints.

## Quick-Start Prompts

Four pre-written analytical questions render as clickable buttons in the empty state. Clicking one immediately fires `send()`. They disappear after the first message is sent.

These replace the old static suggestion chips that were always visible at the bottom of the panel.

## Contextual Follow-Up Chips

After each assistant stream completes (on the `done` SSE event), fires `POST /api/sessions/[id]/followups` with the raw assistant message to get 2-3 follow-up questions.

Chips render only below the **most recent** assistant message. While loading, three pulsing placeholder pills are shown. Clicking a chip sends that question and clears the chips. The backend calls [[lib/llm/followups.ts#generateFollowups]], which strips citation tokens before sending to the LLM (`max_tokens=200`).

## Guardrails

Two layers of protection prevent off-topic or malformed inputs.

**Input validation** (`[[lib/guard/preCheck.ts#preCheck]]`): rejects messages shorter than 3 characters with HTTP 400 before the LLM is ever called.

**LLM-level refusal** (`[[lib/llm/prompt.ts#buildSystemPrompt]]`): system prompt rules 2–3 instruct the model to refuse questions about other products, competitors, or unrelated world knowledge. Refusals begin with `[refusal]` and the frontend renders them inline. Rule 5 blocks prompt-injection via review text; rule 6 prohibits fabrication.

## Upload Templates

Static templates in `public/` help users format CSV or JSONL uploads correctly before submitting.

`public/template.csv` and `public/template.jsonl` each contain 3 example rows covering all supported columns. Download links appear in `[[components/NewSessionForm.tsx]]` below the file upload drop zone. Required columns are `text` and `date`; optional are `author`, `rating` (1–5), `source_url`, `verified`.

## Ingestion Result Summary

After any ingest (URL or file upload), `[[components/NewSessionForm.tsx]]` fetches the created session via `GET /api/sessions/[id]?limit=0` and renders an inline summary card instead of immediately redirecting.

The card shows: subject name, source badge, review count, verified count, avg rating with stars, and date range. A "Start Analysis →" button navigates to the session page. If zero reviews were imported, the button is disabled and a warning is shown. A "Start over" button resets the form.

The session metadata strip also shows: original filename (CSV/JSONL uploads), requested cap vs imported count (URL scrapes — amber highlight when they differ), and ingested timestamp. Both `file_name` and `requested_cap` are stored in the `sessions` table and populated at ingest time.

## Demo Recorder

`[[scripts/record-demo.js]]` automates a full 3-minute browser walkthrough covering all features: home page, ingestion, Insight Brief, Quick-Start Prompts, AI response with citations, Follow-Up Chips, guardrail refusal, and input validation.

Voice-over is generated via macOS `say` TTS (Samantha, 160 wpm) per scene, concatenated into a single AIFF, then mixed onto the video with ffmpeg. Set `SKIP_VOICEOVER=1` to skip TTS. Set `EXISTING_SESSION_ID` to skip ingestion.
