# Plan: Above-and-Beyond UX Features

## Target files

| File | New/Modify | Purpose |
|------|-----------|---------|
| `lib/types.ts` | Modify | Add `InsightTheme`, `InsightBrief` types |
| `lib/llm/insight.ts` | New | LLM call that returns `InsightBrief` JSON |
| `lib/llm/followups.ts` | New | LLM call that returns `string[]` of follow-up questions |
| `app/api/sessions/[id]/insight/route.ts` | New | GET handler — fetch reviews → generateInsight |
| `app/api/sessions/[id]/followups/route.ts` | New | POST handler — assistant message → generateFollowups |
| `components/ChatPanel.tsx` | Modify | All 3 UX changes + fetchFollowups call after 'done' |
| `lat.md/chat-features.md` | New | Document new features in knowledge graph |
| `lat.md/lat.md` | Modify | Add pointer to chat-features.md |

## Pseudocode

### lib/llm/insight.ts
```
PROMPT: structured JSON analyst prompt (see spec §3)
generateInsight(reviews[]):
  client = getClient()
  reviewLines = reviews.slice(0, 200).map(r => "(rating) text")
  response = client.messages.create(model, max_tokens=512, [{role:'user', content: prompt + reviewLines}])
  raw = response.content[0].text
  json = strip markdown fences
  return JSON.parse(json) as InsightBrief
```

### lib/llm/followups.ts
```
PROMPT: "suggest 2-3 follow-up questions, return JSON array"
generateFollowups(assistantMessage: string):
  client = getClient()
  response = client.messages.create(model, max_tokens=200, [{role:'user', content: prompt + msg.slice(0,2000)}])
  raw = response.content[0].text
  parsed = JSON.parse(strip fences(raw))
  return Array.isArray(parsed) ? parsed.slice(0,3) : []
```

### ChatPanel.tsx new state
```
insightBrief: InsightBrief | null  (null while loading or on error)
insightLoading: boolean            (true until /insight resolves or rejects)
insightExpanded: boolean           (user toggle)
followups: Map<msgId, string[]>    (chips per message)
followupsLoading: Set<msgId>       (skeleton while fetching)
```

### ChatPanel.tsx render structure
```
<div class="glass-card flex flex-col">
  <!-- Insight brief card (top of scroll area) -->
  {(insightLoading || insightBrief) && <InsightCard />}

  <!-- Messages -->
  {messages.length === 0 && <EmptyState with QUICK_START chips />}
  {messages.map(msg => (
    <MessageBubble />
    {msg.id === lastAssistantMsgId && <FollowUpChips />}
  ))}

  <!-- Input -->
  <InputBar />
</div>
```

## Integration points

- `GET /api/sessions/[id]/insight` → `getAllReviews(id)` → `generateInsight` → JSON response
- `POST /api/sessions/[id]/followups` body `{ assistantMessage }` → `generateFollowups` → JSON response
- ChatPanel fetches both endpoints client-side (useEffect + inline fetch)

## Risks

- LLM JSON parsing failure: mitigated by try/catch in both lib functions, component suppresses gracefully
- Token cost per session: insight caps at 200 reviews × ~100 chars avg ≈ 20K chars input → acceptable
- Follow-ups add ~1 LLM call per assistant response: low cost (max_tokens=200, short system)

## Assumptions

- No schema changes needed (no caching in DB)
- `getAllReviews` already exists in repo.ts (confirmed)
- Anthropic SDK non-streaming `messages.create` works identically to streaming (confirmed)
