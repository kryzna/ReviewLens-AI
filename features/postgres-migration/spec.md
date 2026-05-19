# Spec: SQLite → PostgreSQL Migration

## Mandate
Replace better-sqlite3 (SQLite) with pg (node-postgres) so the app can deploy to Railway free tier using Railway's managed PostgreSQL, with no other behavior changes.

## Tech Stack
- `pg` 8.13.x — node-postgres client
- `@types/pg` 8.11.x — TypeScript types
- Node.js 20, Next.js 15.5, TypeScript 5.4
- Remove: `better-sqlite3`, `@types/better-sqlite3`

## Data Models
Schema unchanged in structure. SQL dialect changes:
- `verified INTEGER` → `BOOLEAN` (Postgres native)
- `rating_avg REAL` → `DOUBLE PRECISION`
- Parameterized queries: `@named` → `$1, $2, $N` positional
- Remove SQLite-specific pragmas (WAL, foreign_keys)
- Add `ON DELETE CASCADE` via FK constraint (already present)

Connection via `DATABASE_URL` env var (Railway injects this automatically).

## Non-Goals
- No ORM, no migration framework (Prisma, Drizzle, etc.)
- No schema versioning or migration history
- No connection pooling beyond pg.Pool defaults
- No change to API contracts, TypeScript types, or UI behavior

## Boundary Conditions
- Never drop/alter existing tables if data exists — schema uses `CREATE TABLE IF NOT EXISTS`
- Never commit `DATABASE_URL` or any secret
- All repo functions become async — callers must await them
- `verified` boolean: SQLite stored `0/1`, Postgres returns `true/false` — fix comparison in `rowToReview`

## Escalation Protocol
Encounter missing dependency, conflicting schema, ambiguous requirement, or contradiction between this spec and existing codebase: **stop**. Describe blocker one paragraph, propose 2–3 options with tradeoffs, ask clarification. **No speculative code.**
