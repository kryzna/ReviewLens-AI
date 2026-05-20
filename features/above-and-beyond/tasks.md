# Tasks: Above-and-Beyond UX Features

- [x] T1. Add InsightBrief types to lib/types.ts
  - Files: lib/types.ts
  - Tests: TypeScript compile passes

- [x] T2. Create lib/llm/insight.ts — structured LLM call returning InsightBrief JSON
  - Files: lib/llm/insight.ts
  - Tests: manual curl against /api/sessions/[id]/insight returns valid JSON

- [x] T3. Create lib/llm/followups.ts — LLM call returning string[] of follow-up questions
  - Files: lib/llm/followups.ts
  - Tests: POST /api/sessions/[id]/followups returns 2-3 strings

- [x] T4. Create GET /api/sessions/[id]/insight route
  - Files: app/api/sessions/[id]/insight/route.ts
  - Tests: 404 on bad ID, valid JSON on good ID

- [x] T5. Create POST /api/sessions/[id]/followups route
  - Files: app/api/sessions/[id]/followups/route.ts
  - Tests: 404 on bad ID, { suggestions: string[] } on good ID

- [x] T6. Update ChatPanel with all 3 UX features
  - Files: components/ChatPanel.tsx
  - Tests: UI renders insight card on load, quick-start chips show in empty state, follow-up chips appear after assistant message

- [x] T7. Update lat.md knowledge graph
  - Files: lat.md/chat-features.md, lat.md/lat.md
  - Tests: lat check passes
