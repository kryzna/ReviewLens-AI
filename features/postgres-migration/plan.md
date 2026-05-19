# Plan: SQLite → PostgreSQL Migration

## Target Files

| File | Change |
|------|--------|
| `package.json` | Remove better-sqlite3/@types/better-sqlite3, add pg/@types/pg |
| `lib/db/schema.sql` | Postgres dialect: BOOLEAN, DOUBLE PRECISION, remove SQLite pragmas |
| `lib/db/client.ts` | Replace Database singleton with pg.Pool using DATABASE_URL |
| `lib/db/repo.ts` | All functions async, positional $N params, pool.query/client.query |
| `app/api/sessions/route.ts` | await insertSession, insertReviews, listSessions |
| `app/api/sessions/stream/route.ts` | await insertSession, insertReviews |
| `app/api/sessions/[id]/route.ts` | await getSession, getReviews |
| `app/api/sessions/[id]/chat/route.ts` | await getSession, getAllReviews, getMessages, insertMessage |
| `app/api/sessions/[id]/messages/route.ts` | await getSession, getMessages |
| `app/session/[id]/page.tsx` | await getSession, getReviews, getAllReviews, getMessages |
| `Dockerfile` | Remove DB_PATH, keep chromium deps |

## Pseudocode — client.ts
```ts
import { Pool } from 'pg';
let _pool: Pool | null = null;
export function getPool(): Pool {
  if (!_pool) _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return _pool;
}
export async function initDb(): Promise<void> {
  const schema = fs.readFileSync(...schema.sql);
  await getPool().query(schema);
}
```

## Pseudocode — repo.ts (key changes)
- Single queries: `const { rows } = await getPool().query(sql, [p1, p2])` → `rows[0]` or `rows`
- Transactions (insertReviews): checkout client → BEGIN → loop queries → COMMIT/ROLLBACK → release
- `verified` write: pass boolean directly (`r.verified`)
- `verified` read: `Boolean(row.verified)` (handles both Postgres true/false)

## Schema Initialisation
`initDb()` called once at app startup. In Next.js App Router, call from a top-level module that's imported by the first route handler. Use a `_dbReady` promise so concurrent requests don't double-init.

## Dependencies
- Add: `pg@^8.13.0`, `@types/pg@^8.11.0`
- Remove: `better-sqlite3`, `@types/better-sqlite3`

## Risks
- Next.js dev server hot-reload leaks Pool connections → solved by global singleton pattern
- `schema.sql` path in production uses `process.cwd()` + relative path — verify Dockerfile COPY includes it (already does)

## Assumptions (promoted to spec)
- `DATABASE_URL` is the sole connection config; no individual host/port/user env vars
- Schema is idempotent (`IF NOT EXISTS`) — safe to re-run on every cold start
