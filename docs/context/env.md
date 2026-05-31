# Environment and deployment

> Phase 0, section 0.6. Documents every environment variable the app reads and the
> deployment setup. Part of the Phase 0 context-doc set. See also:
> [pipeline](./pipeline.md), [inbound](./inbound.md), [schema](./schema.md),
> [tests](./tests.md), [repo-map](./repo-map.md).

**Status as of 2026-05-08:** 15 variables read from application code + `DIRECT_URL`
read by Prisma directly = **16 total**. There is no `.env.example` in the repo (see
"Things to revisit" #1). Local values live in `.env.local` (gitignored).

## How configuration works here

Every variable is read straight from `process.env` at the point of use — there is no
central config module that validates or types the environment. A variable that is
unset is simply `undefined` at its call site, and each call site decides what that
means. That decision is the important part: for the paid channels, a missing
credential silently degrades to mock mode rather than erroring, which is what keeps
dev and CI from ever paying for a real send.

`NEXT_PUBLIC_`-prefixed variables are inlined into the client bundle at build time by
Next.js and are therefore **not secret** — treat them as public. Everything else is
server-only.

## The variables

### Database

| Variable | Secret | Required | Read by | Notes |
|---|---|---|---|---|
| `DATABASE_URL` | yes | yes | `src/lib/prisma.ts`, `prisma/schema.prisma` | Pooled Postgres connection. `prisma.ts` passes it as an explicit datasource override; if unset, Prisma falls back to the schema's `env("DATABASE_URL")`. |
| `DIRECT_URL` | yes | for migrations | `prisma/schema.prisma` only | Direct (non-pooled) connection used by `prisma migrate`. **Not referenced anywhere in application code** — it reaches Prisma through `datasource.directUrl = env("DIRECT_URL")`. The pooled/direct split is the standard Supabase/Neon pgbouncer pattern. |

### Email — Resend (`src/lib/email.ts`, `src/app/api/inbound/email/route.ts`)

| Variable | Secret | Required | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | yes | for real sends | If absent, `isEmailConfigured()` is false and `resolveEmailMode()` returns `"mock"`. |
| `RESEND_FROM_EMAIL` | no | for real sends | The `From:` address. Also part of `isEmailConfigured()`. |
| `RESEND_INBOUND_SECRET` | yes | for inbound | Verifies the inbound webhook in `/api/inbound/email`. |
| `EMAIL_FORCE_MOCK` | no | no | `"true"` forces mock mode even when fully configured. The sacred email mock switch. |

### Web Push — VAPID (`src/lib/web-push.ts`)

| Variable | Secret | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | no (public) | for real sends | Used on both client and server. Part of `isWebPushConfigured()`. |
| `VAPID_PRIVATE_KEY` | yes | for real sends | Part of `isWebPushConfigured()`. |
| `VAPID_SUBJECT` | no | for real sends | The `mailto:` subject passed to `webpush.setVapidDetails`. |
| `WEB_PUSH_MODE` | no | no | Only `"real"` enables real sends; **any other value (including unset) defaults to mock.** The sacred push mock switch. |

### Cron (`src/app/api/cron/reminders/route.ts`)

| Variable | Secret | Required | Notes |
|---|---|---|---|
| `CRON_SECRET` | yes | yes | Bearer token. The cron route rejects any request whose `Authorization` header isn't `Bearer $CRON_SECRET`. |

### Admin / debug (`src/middleware.ts`, `src/app/api/debug/route.ts`)

| Variable | Secret | Required | Notes |
|---|---|---|---|
| `ADMIN_PASSWORD` | yes | yes in prod | Bearer credential gating `/admin/*` and `/api/debug/*` in middleware. **Fail-open if unset** — see "Things to revisit" #2. |
| `ENABLE_DEBUG_TOOLS` | no | no | `/api/debug` returns 404 unless this is exactly `"true"`. Production default is unset/`false`. |

### App-level

| Variable | Secret | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_BASE_URL` | no (public) | yes | Public base URL. Currently only consumed by `/api/debug`; will be load-bearing for signed links (calendar feed, renewal, unsubscribe) in Phase 2. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | no (public) | no | When set, `layout.tsx` injects the Plausible script. Unset → no analytics, which is the privacy-respecting default. |
| `NODE_ENV` | no | no (framework-set) | Standard Next.js variable. `prisma.ts` caches the client on `globalThis` only when this is not `"production"`. |

## Deployment

- **Host:** Vercel, managed entirely through the Vercel dashboard. No `vercel.json` is
  expected in the repo (resolved decision, 2026-05-08).
- **Node:** version `20` (`.nvmrc`).
- **Build command:** `prisma generate && next build` (the `build` npm script).
- **Database:** PostgreSQL. The pooled `DATABASE_URL` + direct `DIRECT_URL` split is
  the pgbouncer pattern used by Supabase/Neon; migrations run against `DIRECT_URL`.
- **Cron:** there is **no built-in scheduler.** An external service (or local `curl`)
  must hit `GET /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` on a
  schedule. The cadence is owned outside the repo.
- **CI:** there is **no `.github/` directory and no CI workflow** in the repo. The
  CI-gated quality bar described in `claude-code-instructions.md` (lint, `tsc`, tests,
  build) is not yet wired to any automation. (Confirmed in 0.5.)

## Things to revisit

These are flagged for later phases, not fixed now (Phase 0 ships no functional changes).

1. **No `.env.example`.** Both `CLAUDE.md` and `claude-code-instructions.md` reference
   it as the canonical template for required variables, but the file does not exist.
   Add it in Phase 1 so contributors can clone cold and know what to set. (Phase 1.)

2. **Admin middleware fails open.** `src/middleware.ts` returns `NextResponse.next()`
   when `ADMIN_PASSWORD` is unset, so `/admin/*` and `/api/debug/*` are **completely
   unprotected in any environment that forgets to set the password.** It also compares
   the bearer token with a plain `!==` (timing-unsafe). Both should be hardened — fail
   closed in production, constant-time compare. (Phase 1.7.)

3. **`web-push.ts` dead/duplicate logic.** `resolvePushMode()` re-reads
   `WEB_PUSH_MODE` into a second variable (`mode2`) and re-checks the identical
   condition (lines ~34–39); the whole block collapses to
   `if (mode === "real") return "real";`. `resolvePushMode2()` (lines ~43–45) is a
   value-less wrapper that just calls `resolvePushMode()`. Behavior-preserving cleanup.
   (Phase 0.7.)

4. **`debug/route.ts` misleading name.** The variable `debugSecret` holds
   `NEXT_PUBLIC_BASE_URL` (a public value) and is returned as `baseUrl`. The name
   implies a secret it isn't. Rename to `baseUrl`. Behavior-preserving cleanup.
   (Phase 0.7.)

5. **Mock-fallback asymmetry between channels.** `resolveEmailMode()` falls back to
   mock when the channel is unconfigured, but `resolvePushMode()` does not — a
   `WEB_PUSH_MODE=real` with missing VAPID keys will attempt a real send and only fail
   later inside `configureVapid()`. Align the two so an unconfigured push channel also
   degrades to mock. (Phase 1.)

6. **No CI automation.** No GitHub Actions (or other) workflow enforces the lint /
   `tsc` / test / build gate the docs describe. Wire it up. (Phase 1.5.)
