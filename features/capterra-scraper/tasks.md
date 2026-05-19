# tasks.md — Capterra Scraper

- [ ] T1. Create `lib/scrapers/capterra.ts` with `matches()` and Playwright scraper
  - Files: lib/scrapers/capterra.ts
  - Tests: none yet (T2 writes them)
  - Depends on: —
  - Verify: `tsc --noEmit` passes, no import errors

- [ ] T2. Write failing integration tests in `lib/scrapers/capterra.test.ts`
  - Files: lib/scrapers/capterra.test.ts
  - Tests: T1 happy path, T2 field mapping, T3 cap=3, T4 pagination cap=30, T5 bad URL
  - Depends on: T1 (file must exist to import)
  - Verify: `npx jest lib/scrapers/capterra.test.ts` — all 5 fail for right reason (wrong values, not syntax error)

- [ ] T3. Run integration tests green
  - Files: lib/scrapers/capterra.ts (fixes only)
  - Tests: all 5 pass
  - Depends on: T2
  - Verify: `npx jest lib/scrapers/capterra.test.ts --testNamePattern="@integration"` exits 0

- [ ] T4. Register scraper in `lib/scrapers/index.ts` and update error message
  - Files: lib/scrapers/index.ts
  - Tests: none (integration covered by T3)
  - Depends on: T1
  - Verify: `tsc --noEmit` passes; error message reads "Supported: Trustpilot, Capterra."

- [ ] T5. Clean up probe file
  - Files: capterra-probe.ts (delete)
  - Depends on: T3, T4
  - Verify: file gone, `git status` clean except new files
