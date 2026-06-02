# Environment and deployment

> Phase 0, section 0.6. Documents every environment variable the app reads,
> reconciles them against [`.env.example`](../../.env.example) and the
> [README](../../README.md), and describes the deployment setup. Part of the
> Phase 0 context-doc set. See also: [pipeline](./pipeline.md),
> [inbound](./inbound.md), [schema](./schema.md), [tests](./tests.md),
> [repo-map](./repo-map.md).

**Status as of 2026-06-02:** **22 variables are read by application code** (`RESEND_WEBHOOK_SECRET` added in Phase 1.2). They are
declared (with commented guidance) in [`.env.example`](../../.env.example) and
documented in the README's "Environment variables" section. A handful of
`.env.example` entries are declared but **not yet read by any code** — tracked under
"Drift" below.

## How configuration works here

Most configuration flows through one module, [`src/lib/env.ts`](../../src/lib/env.ts),
which exposes typed getters (`getSessionValidityDays()`, `getWebPushMode()`,
`getEnableDebugTools()`, …) that read `process.env`, validate, and fall back to a
sensible default. That is the place to look first for any tunable. A few variables are
read directly at their point of use rather than through `env.ts`:

- `DATABASE_URL` — [`src/lib/db.ts`](../../src/lib/db.ts), the health route, and
  Prisma (`prisma.config.ts`).
- `CRON_SECRET` — [`src/lib/cron-auth.ts`](../../src/lib/cron-auth.ts).
- `NEXT_PUBLIC_APP_URL` / `VERCEL_URL` —
  [`src/lib/public-url.ts`](../../src/lib/public-url.ts).
- `RESEND_API_KEY` / `RESEND_FROM` / `EMAIL_FORCE_MOCK` —
  [`src/lib/providers/email.ts`](../../src/lib/providers/email.ts).
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` —
  [`src/lib/providers/web-push.ts`](../../src/lib/providers/web-push.ts).
- `ENABLE_DEBUG_TOOLS` / `ALLOW_DEBUG_TOOLS_IN_PRODUCTION` —
  [`src/instrumentation.ts`](../../src/instrumentation.ts) (startup warning) and
  `env.ts`.
- `NEXT_PUBLIC_DONATE_URL` —
  [`src/components/app-footer.tsx`](../../src/components/app-footer.tsx).

`NEXT_PUBLIC_`-prefixed variables are inlined into the client bundle at build time and
are therefore **not secret**. Everything else is server-only. There is no central
validation step that errors on a missing required variable — each call site decides;
for the paid channels a missing credential silently degrades to mock mode, which is
what keeps dev and CI from ever paying for a real send.

## The variables (read by code)

### Database

| Variable | Secret | Required | Default | Read by | Notes |
|---|---|---|---|---|---|
| `DATABASE_URL` | yes | yes | — | `db.ts`, health route, `prisma.config.ts` | Postgres connection string. `db.ts` builds a `pg` `Pool` + `PrismaPg` adapter (Prisma 7 driver-adapter pattern) and throws `"DATABASE_URL is not set"` if missing. The Prisma schema's `datasource` has no inline `url`; the URL is supplied by `prisma.config.ts` for migrations and by `db.ts` at runtime. **There is no separate direct/pooled URL split** — one variable does both. |

### Email — Resend ([`providers/email.ts`](../../src/lib/providers/email.ts))

| Variable | Secret | Required | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | yes | for real sends | Real provider requires this **and** `RESEND_FROM`; otherwise `createEmailProvider` returns the mock. Also used by [`fetch-received-email.ts`](../../src/lib/inbound/fetch-received-email.ts) to pull an inbound email's body by id. |
| `RESEND_FROM` | no | for real sends | The `From:` address (e.g. `Mawqit <noreply@domain>`). |
| `EMAIL_FORCE_MOCK` | no | no | `"true"` forces mock even when Resend is fully configured. The sacred email mock switch. |
| `RESEND_WEBHOOK_SECRET` | yes | for inbound | Svix signing secret (`whsec_…`) for the Resend inbound webhook. Read by [`verify-resend-webhook.ts`](../../src/lib/inbound/verify-resend-webhook.ts); unset makes `/api/inbound/email` reject every delivery with `500` (fails closed). |

### Web Push — VAPID ([`providers/web-push.ts`](../../src/lib/providers/web-push.ts), `env.ts`)

| Variable | Secret | Required | Default | Notes |
|---|---|---|---|---|
| `WEB_PUSH_MODE` | no | no | `mock` | Only `"real"` enables real sends (`getWebPushMode()`); any other value, including unset, is mock. The sacred push mock switch. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | no (public) | for real sends | — | Used on client and server. |
| `VAPID_PRIVATE_KEY` | yes | for real sends | — | `ensureVapidConfigured()` **throws** if either VAPID key is missing in real mode (see Drift / "asymmetry" note). |
| `VAPID_SUBJECT` | no | no | `mailto:support@mawqit.local` | `mailto:`/`https:` contact passed to `webpush.setVapidDetails`. |

### Cron ([`cron-auth.ts`](../../src/lib/cron-auth.ts), `env.ts`)

| Variable | Secret | Required | Default | Notes |
|---|---|---|---|---|
| `CRON_SECRET` | yes | yes | — | Bearer token. `verifyCronSecret` does a **constant-time** (`timingSafeEqual`) compare against `Bearer <secret>` and **fails closed** when the secret is unset or empty. |
| `CRON_INTERVAL_MINUTES` | no | no | `5` | Informational only — the documented cadence for the external scheduler. The app does not schedule itself; this value is surfaced for display/docs. |

### Debug / QA ([`env.ts`](../../src/lib/env.ts), [`instrumentation.ts`](../../src/instrumentation.ts))

| Variable | Secret | Required | Default | Notes |
|---|---|---|---|---|
| `ENABLE_DEBUG_TOOLS` | no | no | `false` | Gates `/s/{id}/debug` and debug API routes via `getEnableDebugTools()`. |
| `ALLOW_DEBUG_TOOLS_IN_PRODUCTION` | no | no | `false` | In production, debug tools stay off **even if** `ENABLE_DEBUG_TOOLS=true` unless this is also `true`. `instrumentation.ts` logs a startup warning if the first is set without the second. |
| `ENABLE_QA_REMINDER_CLOCK` | no | no | `false` | Enables the QA reminder-clock offset. Also implicitly enabled when debug tools are on (local convenience). |
| `QA_REMINDER_CLOCK_OFFSET_MINUTES` | no | no | `0` | Signed minutes added to the **reminder clock only** (prayer-due and persistence checks). Session expiry always uses real wall time. |

### App-level

| Variable | Secret | Required | Default | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | no (public) | prod | `localhost:3000` | Canonical origin for share links (`getPublicBaseUrl()`, trailing slash stripped). |
| `VERCEL_URL` | no | no (platform) | — | Vercel-injected deployment hostname; used as the fallback when `NEXT_PUBLIC_APP_URL` is unset. Not declared in `.env.example` because the platform sets it. |
| `NEXT_PUBLIC_DONATE_URL` | no (public) | no | unset | When set, the footer shows the Support / Donate link. |
| `LEARN_TO_PRAY_URL` | no | no | `https://example.com/learn-salah` | Link used in inbound **HELP** replies. |
| `SESSION_VALIDITY_DAYS` | no | no | `30` | Days a session stays valid after a save. |
| `SESSION_EXPIRY_WARNING_DAYS` | no | no | `3` | Days before expiry to send the "renew soon" notice. |
| `NODE_ENV` | no | no (framework-set) | — | Standard Next.js variable. `db.ts` enables verbose Prisma logging in `development`; `env.ts`/`instrumentation.ts` branch on `production` for the debug-tools gate. |

## Drift: `.env.example` / README vs. code

The `.env.example` and README are unusually well-maintained, but a few entries are
declared without a corresponding code reader. These are reconciliation findings, not
bugs:

1. **`BASE_URL`** is declared in `.env.example` (`BASE_URL="http://localhost:3000"`)
   but is **never read anywhere in code** — only `NEXT_PUBLIC_APP_URL` is. The README
   doesn't mention `BASE_URL` either. It's a stale entry. Remove it from
   `.env.example` in the 0.7 cleanup.

2. **`ADMIN_PASSWORD`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`** are declared in
   `.env.example` and the README correctly notes they are "for optional features; not
   required for the main reminder flows." None are read in code today — the
   password-protected `/admin` page is a **Phase 1.5** deliverable. Leave the
   `.env.example` entries as forward-looking placeholders; wire the readers in 1.5.

3. **`PLAUSIBLE_API_KEY`, `PLAUSIBLE_SITE_ID`** are declared (commented) but not read.
   Analytics is not wired yet — a **Phase 3.4** item. Leave as placeholders.

## Deployment

- **Host:** Vercel, managed entirely through the Vercel dashboard. No `vercel.json` is
  expected in the repo (resolved decision, 2026-05-08).
- **Node:** there is **no `.nvmrc` and no `engines` field** in `package.json` — the
  Node version is whatever the host defaults to. Pinning it is a reasonable Phase 1
  hardening item.
- **Build command:** `prisma generate && next build` (the `build` npm script;
  `postinstall` also runs `prisma generate`).
- **Database:** PostgreSQL via the Prisma `pg` driver adapter. Migrations run with
  `npx prisma migrate deploy` against production before first request (per README).
- **Security headers:** [`next.config.ts`](../../next.config.ts) sets
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that
  denies camera/microphone and allows geolocation only for same-origin.
- **Cron:** there is **no built-in scheduler.** An external service (or local `curl`)
  hits `GET /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` on a
  schedule (documented cadence `CRON_INTERVAL_MINUTES`, default 5).
- **Health:** `GET /api/health` returns JSON and skips the DB check when
  `DATABASE_URL` is unset (useful for CI smoke tests).
- **CI:** there is **no `.github/` directory and no CI workflow** in the repo. The
  CI-gated quality bar described in `claude-code-instructions.md` (lint, `tsc`, tests,
  build) is not yet wired to any automation. (Confirmed in 0.5.)

## Things to revisit

Flagged for later phases; Phase 0 ships no functional changes.

1. **Remove stale `BASE_URL` from `.env.example`.** Behavior-preserving — nothing
   reads it. (Phase 0.7.)

2. **Pin the Node version.** No `.nvmrc` / `engines` means local and prod can drift.
   Add one in Phase 1. (Phase 1.)

3. **Channel mock-fallback asymmetry.** `createEmailProvider` falls back to mock when
   Resend is unconfigured, but `ensureVapidConfigured()` *throws* when VAPID keys are
   missing in `WEB_PUSH_MODE=real`. Consider degrading an unconfigured push channel to
   mock instead of throwing, to match email's forgiving behavior. (Phase 1.)

4. **No CI automation.** No GitHub Actions (or other) workflow enforces the lint /
   `tsc` / test / build gate the docs describe. Wire it up. (Phase 1.5.)

5. **Admin and Plausible variables are declared but unimplemented.** Track that the
   `ADMIN_*` readers land in Phase 1.5 (admin page) and `PLAUSIBLE_*` in Phase 3.4
   (analytics), so the `.env.example` placeholders don't rot. (Phases 1.5 / 3.4.)
