# Tasks: SQLite → PostgreSQL Migration

- [ ] T1. Swap dependencies in package.json
  - Files: package.json
  - Tests: `npm install` succeeds, `import { Pool } from 'pg'` resolves
  - Depends on: —

- [ ] T2. Rewrite lib/db/schema.sql for Postgres dialect
  - Files: lib/db/schema.sql
  - Tests: schema runs without error against a Postgres connection
  - Depends on: T1

- [ ] T3. Rewrite lib/db/client.ts — pg.Pool singleton + initDb()
  - Files: lib/db/client.ts
  - Tests: getPool() returns Pool; initDb() runs schema without error
  - Depends on: T1, T2

- [ ] T4. Rewrite lib/db/repo.ts — all functions async, positional params
  - Files: lib/db/repo.ts
  - Tests: TypeScript compiles; verified boolean handled correctly
  - Depends on: T3

- [ ] T5. Update all API route callers to await repo functions
  - Files: app/api/sessions/route.ts, app/api/sessions/stream/route.ts, app/api/sessions/[id]/route.ts, app/api/sessions/[id]/chat/route.ts, app/api/sessions/[id]/messages/route.ts
  - Tests: TypeScript compiles; no unhandled promise rejections
  - Depends on: T4

- [ ] T6. Update server component caller
  - Files: app/session/[id]/page.tsx
  - Tests: TypeScript compiles
  - Depends on: T4

- [ ] T7. Update Dockerfile — remove DB_PATH reference, add DATABASE_URL note
  - Files: Dockerfile
  - Tests: `docker build` succeeds
  - Depends on: T3
