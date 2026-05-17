# ReviewLens AI — Consolidated spec

## Source

This document consolidates every decision made for ReviewLens AI. The only ground-truth input is the project brief; everything below is interpretation, commitment, or recommendation. Where the brief is silent, a decision has been made and flagged.

## Goal

A web portal where an analyst ingests reviews for a single product or entity from one platform, sees a clear summary of what was ingested, and Q&A's over that data with a strict scope guard. Public URL, no auth, deployable. 5-hour build target, not a hard cap.

## Non-goals

Multi-platform ingestion in one session. User accounts, saved searches, workspaces. Sentiment dashboards or analytics beyond the ingestion summary. Continuous monitoring or alerts. Cross-product or competitive comparison. Fake-review detection. Multi-tenant access control. Multi-language UI beyond what the LLM handles natively. These are intentionally excluded to protect the build scope; they map to features a production ORM platform would have, addressed in the scale-out section.

## Platform & ingestion

**Primary platform: Trustpilot.** Amazon and Google Maps have anti-bot defenses plus ToS that prohibit scraping; G2 and Capterra are similarly defended. Trustpilot qualifies as a "similar publicly accessible platform" per the brief, has clean paginated HTML, and the lightest defenses among credible options. Tradeoff: less recognizable in the demo than Amazon. If recognizability matters more than tractability, swap to G2.

**Two ingestion modes:**

- **URL scrape (Trustpilot only):** target URL → scraper extracts up to 500 reviews → schema normalized → persisted under a session ID.
- **File upload (any source):** CSV or JSONL with fields `author`, `rating`, `date`, `text`, `source_url` (optional). Upload is platform-agnostic; the source dropdown is metadata for display and citation linking, not a behavior switch.

**Review cap: 500 per session.** Keeps ingestion under ~30s and token cost bounded. Brief is silent on volume; this is an assumption.

The source selector in the new-session form lists Trustpilot, Amazon, Google Maps, G2, Capterra, App Store, Other. Only Trustpilot is wired for URL scraping in the prototype; other sources require file upload. The selector does not enforce this; the README documents the constraint.

## Q&A architecture

**Stuff-in-context, no RAG.** With a 500-review cap and modern LLM context windows, vector retrieval adds infrastructure without value. Tradeoff: higher per-query token cost than top-k retrieval, negligible at demo traffic. If the cap moves past ~5k reviews, revisit.

**Multi-turn conversation.** User and assistant turns are persisted and replayed on each call. Reviews live in the system prompt; history lives in the message array. If history grows past budget, summarize the oldest turns rather than dropping silently.

**Citations are mandatory in every answer.** The system prompt instructs the model to ground every claim using a `[r:{id}]` token. The UI parses these, renders them as clickable chips, and resolves to (a) the in-app review card and (b) the external permalink on the source platform.

LLM choice is undecided and doesn't materially affect the spec. Claude Sonnet, GPT-4o-class, or Gemini Pro all work; pick by API access and setup speed.

## Persistence

**Durable SQLite with attached disk.** Each session is keyed by a UUID and reloadable at `/session/{id}`. Schema:

- `sessions`: id, source_platform, source_url, ingested_at
- `reviews`: id, session_id, source_review_id, author, rating, date, text, source_url
- `messages`: id, session_id, role, content, citations, timestamp

Brief was silent on persistence; user clarification was "yes, persist for troubleshooting." Schema is Postgres-compatible so a future migration is a connection-string change plus an embedding column.

**Privacy note:** no auth + persistent conversations means anyone with a session URL can read its history. Documented in the README so it isn't a surprise.

## Scope guard

**System prompt is primary**, per the brief. The prompt instructs the model to answer only from the reviews ingested in this session, refuse comparisons with other platforms or competitor brands, refuse general world knowledge, and say "not in the data" when a question is in scope but unsupported.

**Two cheap additions:**

1. Reject obviously empty or out-of-scope prompts before they hit the model.
2. Include only ingested review text in the context window — no other sources — so prompt injection can't smuggle in external data.

Tradeoff: system-prompt-only guards are bypassable by determined prompt injection. The brief accepts this by specifying "primarily driven by your system prompt." The limitation is documented.

## Data model

Internal review schema is platform-agnostic: `(source_platform, source_review_id, author, rating, date, text, source_url)`. No Trustpilot-specific fields leak past the scraper. Source-specific extras (e.g., Amazon "verified purchase") land in an optional `extra` JSON column.

## UX

Two top-level views toggled from the header, plus an internal tab switch in the active view.

**Header.** Brand mark left. Session ID, desktop/mobile preview toggle (mockup demo aid only — production uses real media queries), and "New session" button on the right. Stacks vertically on narrow viewports.

**Active session view, in order:**

- **Summary card.** Subject name + clickable link to the original platform page, headline rating with a star icon, meta line (review count, date range, verified count, ingestion freshness), and a per-star distribution as horizontal bars. This card is the answer to the brief's "give the user confidence the data is accurate, sufficiently complete, and ready for analysis."
- **Tabs: Chat | Reviews (count).** Default tab is Chat.
- **Chat panel.** User messages right-aligned in info color; assistant messages left-aligned white with subtle border. Refusal messages use a distinct amber-bordered style with a shield icon, making the scope guard visible as a feature, not a failure. Citation chips `[r:N]` are inline in answers and link to the source platform. Each grounded assistant answer ends with 2–3 follow-up suggestion chips that send a templated question when clicked.
- **Reviews panel.** Rating filter chips (All / 5★ / 4★ / 3★ / 2★ / 1★) at the top. List of review cards showing stars, author, verified badge, date, text, review ID, and "View on source" external link. Footer shows "Showing N of total" with a load-more affordance.
- **Input row.** Text field + send button at the bottom of the Chat tab. Hidden on the Reviews tab. Tradeoff: not persistent across tabs — can't ask a question while looking at raw reviews. Alternative is a drawer/overlay for reviews; tabs chosen for simplicity.

**New session view:**

- Source dropdown (Trustpilot, Amazon, Google Maps, G2, Capterra, App Store, Other), default Trustpilot.
- URL input, placeholder shaped for the default source.
- Visual divider.
- File upload zone accepting CSV or JSONL, with field hints inline.
- Single "Ingest reviews" button below both inputs.

**Mobile layout.** Below ~480px the header stacks vertically, the summary card's rating moves to its own line, chat bubbles widen to 92% of the column, follow-up chips and filter chips wrap. No tap-target or layout regression. Production uses CSS media queries; the mockup uses a toggle so the mobile state is viewable from desktop.

## Scale-out hedges

Three architectural decisions cost almost nothing now but protect the path to a real ORM platform:

1. **Platform-agnostic ingestion contract.** Adding Amazon or any other source later means one new scraper emitting the unified schema — no changes to storage, Q&A, or UI.
2. **Postgres-compatible storage.** SQLite for now, no SQLite-only features. Migration to Postgres + pgvector is a connection-string change plus an embedding column.
3. **Stable source review IDs in citations.** When retrieval moves from stuff-in-context to embeddings, retrieved chunks carry the same IDs, so the citation UI doesn't change.

Everything else — the scraper itself, in-process Q&A, single-tenant, single-platform — will be replaced wholesale at scale. That's the correct call for a 5-hour build.

## Hosting & deployment

**One box, one deploy.** Fly.io, Railway, or Render with an attached volume for the SQLite file. Brief asks for a public URL with no auth. Vercel serverless is ruled out: ephemeral filesystem doesn't fit SQLite + persistent disk. Alternative is stateless host + managed Postgres (Neon, Supabase), which costs more setup for a 5-hour build and adds an external dependency. Single-box wins.

Stack is framework-agnostic. Next.js + TypeScript + Tailwind on a single box, or a Node/Python backend + static frontend, both fine. Pick what ships fastest.

## Success criteria

1. Given a valid Trustpilot URL, the app extracts ≥50 reviews (or all available) within 60 seconds and renders the summary card with count, date range, rating, verified count, and distribution.
2. Given an uploaded CSV or JSONL matching the documented schema, the app produces the same summary.
3. Given an in-scope question, the app responds with a grounded answer citing specific reviews via `[r:N]` chips that link to the source platform.
4. Given an out-of-scope question (other platform, general knowledge, competitor comparison), the app refuses and explains the scope.
5. Session is reloadable at `/session/{id}` after a deploy restart.
6. App is reachable at a public URL with no login.
7. `/ai-transcripts` directory in the repo contains unedited AI session logs.
8. README documents setup, architecture, assumptions, and known limitations (privacy of session URLs, prototype-only URL scraping for Trustpilot, scope-guard bypass risk).

## Risks & tradeoffs

**Scraper fragility.** Trustpilot can change DOM or rate-limit. Mitigation: file upload is a first-class fallback; demo can fall back to a saved dataset if the live scrape fails.

**Legal/ToS.** Scraping review platforms is discouraged by their ToS. The brief requires this; document the choice and risk in the README.

**Hallucination.** Stuffing reviews into context mitigates but doesn't eliminate. Mitigation: require citations in every answer; instruct the model to say "not in the data" when ungrounded; suppress or flag uncited claims at render.

**Scope-guard bypass.** System-prompt-only guards are bypassable by sophisticated prompt injection. Brief accepts this; limitation documented.

**Per-query cost.** Stuffing 500 reviews per turn is not free. Mitigation: cap session length; if cost matters, pre-summarize each review at ingestion and pass summaries instead.

**Privacy of session URLs.** Anyone with a URL can read the conversation. Brief specifies no auth; documented in README.

## Deferred refinements

Called out during UX iteration as deliberately excluded from the prototype, worth picking up in a v2:

- Loading and streaming states for ingestion and chat responses.
- Error states: scrape failed, malformed file, LLM timeout, rate limit.
- Search-within-reviews on the Reviews tab.
- Dynamic URL placeholder that updates when the source dropdown changes.
- Disabling the URL field when a non-Trustpilot source is selected, with an explanatory hint pointing to file upload.
- Source-specific schema extras in the `extra` JSON column (e.g., Amazon "verified purchase").
- "Ask about this theme" affordances inside theme blocks for one-click drill-in.
