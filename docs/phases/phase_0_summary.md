# Phase 0 summary — Exploratory pass and cleanup

**Status:** complete. Shipped in PR #1 (`chore: phase 0 cleanup`), merged to `main`.

## What was built (plain English)

Phase 0 didn't ship a feature — and that was the point. Before we start changing how
Mawqit behaves in production, we needed a trustworthy, written model of how it *already*
behaves. So this phase produced documentation, not code (with one small, deliberately
behavior-preserving cleanup at the end). The deliverable is a set of seven context docs
under `docs/context/` that together describe the whole system as it actually is today,
file by file, with the surprising bits flagged. Every later phase reads these instead of
re-deriving the codebase from scratch each session.

The seven docs map cleanly onto the parts of the system a later change is most likely to
touch. [`repo-map.md`](../context/repo-map.md) is the directory tour — what lives where,
which routes are public vs. session-scoped vs. API. [`schema.md`](../context/schema.md)
covers the seven Prisma models, the enums, the cascade rules, and — importantly — the
two partial unique indexes that make the send ledger idempotent. [`pipeline.md`](../context/pipeline.md)
traces a single cron invocation from `GET /api/cron/reminders` all the way to a delivered
email or push, including the four-pass execution order and the "claim-then-send" ledger
pattern that prevents double-sends. [`inbound.md`](../context/inbound.md) documents
`handleInbound` and every outcome of an inbound message (STOP, HELP, the various
no-op cases). [`tests.md`](../context/tests.md) is an honest coverage map: what's tested,
what only *looks* tested, and where the gaps are. [`env.md`](../context/env.md)
reconciles every environment variable the code reads against `.env.example` and the
README. And [`cleanup.md`](../context/cleanup.md) records what the 0.7 cleanup changed and,
just as importantly, what it deliberately left alone.

The cleanup itself (section 0.7) was tiny on purpose. The rule for the phase was
"behavior-preserving only," so the changes are all renames, deletions of files nothing
references, and one stale config line. We renamed `src/lib/utils.ts` to
`src/lib/class-names.ts` (the repo's own rules forbid catch-all `utils.ts` filenames, and
the file holds exactly one thing — the `cn()` Tailwind class-merge helper), deleted five
unused `create-next-app` starter SVGs, and removed a dead `BASE_URL` line from
`.env.example` that no code reads. That's it. The temptation in a cleanup pass is to "fix"
things that look off; we resisted that and instead *wrote down* the things that look off
so they can be fixed deliberately, with tests, in the phase that owns them.

The most valuable output of the phase is probably the set of flags scattered through
these docs — places where the code does something non-obvious, or where a later phase
will need to be careful. A few examples that will matter soon: the cron's email and push
reminder passes have tests, but those tests only check the empty-input case, so the
actual send-and-ledger logic is effectively uncovered; SMS is structurally dormant
(`smsEnabled` is hard-coded false on every save); and the email and push channels handle
a missing-credentials situation differently (email degrades to mock, push throws). None
of these are bugs we fixed in Phase 0 — they're a map of where the real work is.

## Concepts introduced

Phase 0 was mostly about *reading* the existing system, so there aren't many brand-new
production concepts yet. The few worth naming:

- **Idempotency / the send ledger.** "Idempotent" means an operation can run more than
  once without changing the result beyond the first time. The cron can fire multiple
  times for the same prayer window; the send ledger (a `sent_reminders` table guarded by
  partial unique indexes) guarantees each reminder goes out at most once. The pattern is
  "claim-then-send": insert the ledger row first, and only send if the insert succeeded.
  This is load-bearing and protected by the repo rules.

- **Partial unique index.** A normal unique index forbids duplicate values across a whole
  column. A *partial* unique index applies the constraint only to rows matching a
  condition (a `WHERE` clause). Mawqit uses these so the "one send per cycle" rule is
  enforced by the database itself, not just by application code.

- **Mock modes.** `EMAIL_FORCE_MOCK`, `WEB_PUSH_MODE=mock`, and the future
  `WEB_SMS_MODE` let the full pipeline run in dev and CI without paying a real provider
  or spamming anyone. The relevant insight from 0.6: when a paid channel's credentials
  are missing, the code *silently degrades to mock* rather than erroring — that's
  intentional, and it's why a misconfigured deploy fails safe instead of throwing.

- **Behavior-preserving refactor.** A change that alters structure (names, file
  locations, dead-code removal) without changing any observable runtime behavior. The
  whole 0.7 cleanup was held to this standard, verified by the test/lint/build suite
  being identical before and after.

## Why the choices were made

A few decisions in this phase deserve a sentence of "why":

- **Docs before code, always.** Phase 0 exists because getting the mental model wrong is
  expensive later. The class-project codebase has real subtlety (the dual-clock model,
  the four-pass cron, the ledger), and a written map pays for itself the first time a
  Phase 1 change would otherwise have broken idempotency by accident.

- **`class-names.ts`, not something generic.** When renaming `utils.ts`, the new name
  describes the contents (it's a class-name merger) rather than just relocating the
  catch-all. The `cn` export name stayed because it's a near-universal Tailwind/shadcn
  idiom — renaming it would have churned every component for no readability gain. We also
  updated the shadcn `utils` alias in `components.json` so future `npx shadcn add`
  commands generate imports against the new path.

- **We changed no dependencies.** `depcheck` flagged six things; every one was a false
  positive (runtime-only deps, CSS `@import`s, a Prisma config import). Removing any of
  them would have broken the build. The lesson recorded in `cleanup.md`: tool output is a
  starting point, not a verdict — each hit was verified by hand before being dismissed.

- **The empty `webhooks/resend/` directory stays.** It's an open question for you (its
  intent is unclear), and the safe default is to leave it until Phase 1.2 wires the real
  inbound webhook. Deleting it would have been a guess.

## Verification steps

Phase 0's acceptance gate is "you read through `docs/context/*.md`, confirm it matches
your mental model, and the cleanup PR is reviewed and merged." That review already
happened (PR #1 is merged). The mechanical checks anyone can re-run from a clean checkout:

1. **The cleanup is behavior-preserving — tests still green.**
   ```
   npm test
   ```
   Expect: `Test Files 38 passed (38)` and `Tests 107 passed (107)`. Same numbers as
   before the cleanup.

2. **Lint and types are clean.**
   ```
   npm run lint        # expect: exit 0, no output
   npx tsc --noEmit    # expect: exit 0, no output
   ```

3. **The production build succeeds** (needs a `DATABASE_URL` set, even a dummy one, because
   the build collects page data for `/api/health` which constructs the Prisma client):
   ```
   DATABASE_URL="postgresql://u:p@localhost:5432/db" npm run build
   ```
   Expect: `✓ Compiled successfully`, then the route table, then exit 0. **Note:** with
   `DATABASE_URL` unset the build fails at page-data collection — that's pre-existing and
   environmental, not something Phase 0 introduced.

4. **The rename is complete — nothing imports the old path.**
   ```
   grep -rn "lib/utils" src --include="*.ts" --include="*.tsx" | grep -v src/generated
   ```
   Expect: no output. And `src/lib/class-names.ts` exists while `src/lib/utils.ts` does
   not.

5. **The starter SVGs are gone; the service worker remains.**
   ```
   ls public/
   ```
   Expect: only `sw.js` (the live Web Push service worker), none of
   `file/globe/next/vercel/window.svg`.

6. **All seven context docs exist and are tracked.**
   ```
   git ls-files docs/context/
   ```
   Expect: `cleanup.md`, `env.md`, `inbound.md`, `pipeline.md`, `repo-map.md`,
   `schema.md`, `tests.md`.

## Heads-up for the next phase

Per the PLAN's execution order, **Phase 1.4 (the schema migration) comes first** — before
domain setup, before inbound email — because the data model is more painful to change once
there's production data on it. That migration introduces the `subscriptions`,
`saved_locations`, `notification_recipients`, and `donations` tables, and migrates the
current single-value email/location fields onto the new one-to-many tables while keeping
existing sessions working. `schema.md` already marks which fields are headed for that 1:N
move, so start there.

Two operational notes for Phase 1:

- **No CI exists yet.** There's no `.github/` workflow running lint/tsc/test/build on PRs,
  even though the repo rules describe a CI-gated bar. Phase 1.5 should wire that up — and
  doing it early means every later PR is automatically checked.
- **The test suite's cron coverage is thinner than it looks.** `tests.md` is explicit
  about this: the reminder-pass tests only assert the empty-input case. Any Phase 1 change
  near the cron or the ledger should add the real happy-path and rollback-on-failure tests
  that are currently missing, rather than trusting the green checkmark.
