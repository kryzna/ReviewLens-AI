# spec.md — Scrape Progress Indicators

## 1. Mandate

Stream live progress steps to the UI during URL ingestion (Navigating → Extracting n/cap → Saving → Done) using SSE, replacing the static "Importing…" button text with a numbered step list.

## 2. Tech Stack

- Next.js 14 App Router (existing)
- SSE via `ReadableStream` + `TransformStream` (no extra deps)
- React 18 state (existing)
- TypeScript 5.4 (existing)

## 3. Data Models

SSE events (text/event-stream):
```
event: navigating
data: {"message":"Navigating to Trustpilot…"}

event: extracting
data: {"count":20,"cap":500,"message":"Extracting reviews: 20 / 500"}

event: saving
data: {"message":"Saving to database…"}

event: done
data: {"sessionId":"abc-123","count":50}

event: error
data: {"message":"Bot detection blocked request. Try file upload."}
```

ProgressCallback type (added to `lib/types.ts`):
```ts
export type ProgressEvent =
  | { type: 'navigating'; source: string }
  | { type: 'extracting'; count: number; cap: number };

export type ProgressCallback = (evt: ProgressEvent) => void;
```

Updated Scraper interface:
```ts
interface Scraper {
  matches(url: string): boolean;
  scrape(url: string, cap: number, onProgress?: ProgressCallback): Promise<ScrapeResult>;
}
```

## 4. Non-Goals

- No WebSocket
- No progress for file uploads (instant — no need)
- No persistent job queue / background workers
- No retry UI

## 5. Boundary Conditions

- Keep existing `POST /api/sessions` unchanged (file uploads still use it)
- SSE endpoint is GET-only: `GET /api/sessions/stream?url=...`
- Frontend falls back to error state if SSE connection drops unexpectedly
- Always close `EventSource` on done/error to avoid leaks

## 6. Escalation Protocol

Encounter missing dependency, conflicting schema, ambiguous requirement, or contradiction between this spec and existing codebase: **stop**. Describe blocker, propose 2–3 options, ask. No speculative code.
