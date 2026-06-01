# Phase 0.7 cleanup

> What the behavior-preserving cleanup pass removed or changed, and — just as
> important — what it deliberately left alone. Part of the Phase 0 context-doc set.
> Ships as the `chore: phase 0 cleanup` PR.

The rule for this pass: **no behavior changes.** Every edit is a rename, a deletion of
something nothing references, or a doc-only line. The full verification suite was green
before and after (see "Verification" below).

## What changed

### 1. Renamed `src/lib/utils.ts` → `src/lib/class-names.ts`

`CLAUDE.md` forbids `utils.ts`-style catch-all filenames, and the project owner already
resolved (2026-05-08) to rename this one. The file holds a single export — `cn()`, the
standard Tailwind class-merge helper — so `class-names.ts` describes exactly what's
inside. The `cn` export name is unchanged (it's a universally-known shadcn/Tailwind
idiom).

Updated together so nothing breaks:
- The 7 component importers (`@/lib/utils` → `@/lib/class-names`):
  `prayer-times-display.tsx`, `setup-form.tsx`, `session-subnav.tsx`, and the four
  `ui/` primitives (`button`, `card`, `input`, `label`).
- The test file, renamed `utils.test.ts` → `class-names.test.ts` with its relative
  import updated.
- The shadcn `utils` alias in `components.json` (`@/lib/utils` →
  `@/lib/class-names`), so any future `npx shadcn add` generates imports against the
  new path.

### 2. Deleted 5 unused `create-next-app` SVGs

`public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — scaffolding
left over from project creation, referenced nowhere in the codebase. `public/sw.js` was
**kept**: it's the live service worker that Web Push and `showNotification` register
(`service-worker-register.tsx`, `show-debug-notification.ts`).

### 3. Removed stale `BASE_URL` from `.env.example`

`BASE_URL` was declared in `.env.example` but read by no code and not mentioned in the
README — only `NEXT_PUBLIC_APP_URL` is actually used for share-link origins
(`src/lib/public-url.ts`). Removed the dead line. (Flagged in
[`env.md`](./env.md) drift #1.)

## What was deliberately NOT touched

Cleanup is only valuable if it's trustworthy, so the things that *looked* removable but
weren't are worth recording:

- **No dependency changes.** `depcheck` flagged `@prisma/client`, `shadcn`,
  `tw-animate-css`, `@tailwindcss/postcss`, `tailwindcss` as unused and `dotenv` as
  missing — **all false positives.** `@prisma/client` is required at runtime by the
  generated client; `shadcn` and `tw-animate-css` are imported in
  `src/app/globals.css`; `@tailwindcss/postcss`/`tailwindcss` are used by
  `postcss.config.mjs`; `dotenv` is imported by `prisma.config.ts` (available
  transitively via Prisma). Nothing was added or removed from `package.json`.

- **No "dead export" removals.** A naive export-vs-import scan flagged ~13 symbols, but
  every one is actually used — within its own file (`EmailSendResult`, `SetupPayload`,
  `WebPushSendResult`, etc.) or via an internal caller
  (`createResendEmailProvider` is called by `createEmailProvider` in the same module).
  No exports were deleted.

- **The empty `src/app/api/webhooks/resend/` directory stays.** This is the standing
  open question for the project owner (see `progress.md`). The plan is to leave it
  untouched until Phase 1.2 wires the real inbound webhook. PLAN.md §0.7 lists "empty
  directories" as removable, but the explicit open-question decision overrides that
  here.

- **No `console.*` changes.** The only non-test `console` call in `src/` is
  `console.info` inside `src/lib/logger.ts` — that *is* the structured logger, not a
  stray debug print.

- **No commented-out code or TODO/FIXME** found to remove.

## Verification

All four gates were green after the cleanup:

```
npm run lint     → exit 0 (no warnings/errors)
npx tsc --noEmit → exit 0
npm test         → Test Files 38 passed (38) · Tests 107 passed (107)
npm run build    → exit 0, 29 static pages generated
```

Note on `npm run build`: with `DATABASE_URL` unset (as in a bare local checkout with no
`.env` value), the build fails collecting page data for `/api/health`, which calls
`getPrisma()`. This is **pre-existing and environmental** — it reproduces identically on
`main` and is unrelated to this cleanup (no files touched here go near the health route
or `src/lib/db.ts`). With any `DATABASE_URL` set, the build completes cleanly.
