# Chat Features

AI-powered features in the session chat panel beyond basic Q&A, implemented in [[components/ChatPanel.tsx]].

## Proactive Insight Brief

Fetches `GET /api/sessions/[id]/insight` on session load and renders a collapsible card with sentiment label, star score, summary, and 3 top themes with verbatim quotes — before the user asks anything.

The backend calls [[lib/llm/insight.ts#generateInsight]], which caps input at 200 reviews and requests JSON output (`max_tokens=600`). Parse errors are caught and suppressed; the card simply does not appear on failure.

Result is persisted in `sessions.insight_brief` (JSON text column). On subsequent loads the cached value is returned immediately — no LLM call. Cache is permanent; re-ingesting creates a new session with no cache.

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
