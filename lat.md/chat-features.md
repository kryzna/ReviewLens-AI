# Chat Features

AI-powered features in the session chat panel beyond basic Q&A, implemented in [[components/ChatPanel.tsx]].

## Proactive Insight Brief

Fetches `GET /api/sessions/[id]/insight` on session load and renders a collapsible card with sentiment label, star score, summary, and 3 top themes with verbatim quotes — before the user asks anything.

The backend calls [[lib/llm/insight.ts#generateInsight]], which caps input at 200 reviews and requests JSON output (`max_tokens=600`). Parse errors are caught and suppressed; the card simply does not appear on failure.

## Quick-Start Prompts

Four pre-written analytical questions render as clickable buttons in the empty state. Clicking one immediately fires `send()`. They disappear after the first message is sent.

These replace the old static suggestion chips that were always visible at the bottom of the panel.

## Contextual Follow-Up Chips

After each assistant stream completes (on the `done` SSE event), fires `POST /api/sessions/[id]/followups` with the raw assistant message to get 2-3 follow-up questions.

Chips render only below the **most recent** assistant message. While loading, three pulsing placeholder pills are shown. Clicking a chip sends that question and clears the chips. The backend calls [[lib/llm/followups.ts#generateFollowups]], which strips citation tokens before sending to the LLM (`max_tokens=200`).
