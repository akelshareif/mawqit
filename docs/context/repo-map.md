# Repo map

Snapshot of the Mawqit codebase as of 2026-05-08, end of Phase 0.1. This file is documentation for navigation, not a spec. Update it whenever the directory structure changes.

## Top-level layout

```
mawqit/
├── CLAUDE.md                  must-know rules loaded at session start
├── README.md                  human-facing setup guide (largely outdated; pre-Phase-1 wording)
├── docs/                      all project docs (PLAN.md, instructions, progress, context/, phases/)
├── prisma/                    Prisma schema and SQL migration history
├── public/                    static assets served at /, including the service worker (sw.js)
├── src/                       application source — Next.js App Router, lib code, generated Prisma client
├── package.json               npm scripts and dependency manifest
├── package-lock.json          npm lockfile
├── tsconfig.json              TypeScript compiler config (strict mode)
├── tsconfig.tsbuildinfo       incremental-build cache (gitignored, but present locally)
├── next.config.ts             Next.js config — sets security headers (X-Frame-Options, CSP-adjacent)
├── next-env.d.ts              Next.js type shim (gitignored)
├── eslint.config.mjs          ESLint flat config
├── postcss.config.mjs         PostCSS config for Tailwind v4
├── components.json            shadcn/ui generator config
├── prisma.config.ts           Prisma CLI config
├── vitest.config.ts           Vitest config
├── vitest.setup.ts            Vitest global setup (jsdom + jest-dom matchers)
├── .env                       local secrets (gitignored)
├── .env.example               documented env vars; the source of truth for what vars exist
├── .gitignore                 standard Next.js gitignore + /src/generated/prisma
├── .next/                     Next.js build output (gitignored)
└── node_modules/              dependencies (gitignored)
```

### `docs/` (2nd level)

```
docs/
├── PLAN.md                            production-migration plan, phase definitions, anti-features
├── claude-code-instructions.md        full operating manual for Claude Code
├── progress.md                        live project state — single source of truth
└── context/                           per-area context files written during Phase 0
    └── repo-map.md                    this file
```

### `prisma/` (2nd level)

```
prisma/
├── schema.prisma                      Postgres schema (12 declarations: 5 enums + 7 models)
└── migrations/
    ├── 20260329194136_init/
    ├── 20260329195309_slice2_session_setup/
    ├── 20260329200228_slice3_prayer_push_stub/
    ├── 20260329210000_slice4_cron_email/
    ├── 20260330120000_slice7_reminder_cycles/
    ├── 20260406202035_slice7/
    └── migration_lock.toml
```

Detailed model audit lands in `schema.md` (Phase 0.2).

### `public/` (2nd level)

```
public/
├── sw.js                              service worker — push notification handler
├── file.svg, globe.svg, window.svg    create-next-app scaffolding (likely unused)
├── next.svg, vercel.svg               create-next-app scaffolding (likely unused)
```

### `src/` (2nd level)

```
src/
├── app/                               Next.js App Router (routes, layouts, server actions)
├── components/                        React components (shared UI + feature components)
├── generated/prisma/                  Prisma Client (generated, gitignored)
└── lib/                               domain logic, providers, utilities
```

## App Router layout

The App Router lives at `src/app/`. There is one root layout, `app/layout.tsx`, that loads fonts and mounts the `ServiceWorkerRegister` component on every page.

### Public routes (no session required)

| Path | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Landing page with "Get started" form (server-action `startSessionAction`) and "Lost your link?" link |
| `/recover` | `app/recover/page.tsx` | Recovery form for users who lost their session link |

### Session-scoped routes (`/s/[sessionId]/...`)

All gated by `app/s/[sessionId]/layout.tsx`, which validates the session ID format, looks up the session in the DB, returns 404 if missing, and renders the `SessionSubnav` + `AppFooter` chrome.

| Path | File | Purpose |
|---|---|---|
| `/s/[sessionId]` | `app/s/[sessionId]/page.tsx` | Redirects to `dashboard` |
| `/s/[sessionId]/dashboard` | `dashboard/page.tsx` | "Today" view — next prayer, day's prayer rows, share card, expiry hint |
| `/s/[sessionId]/setup` | `setup/page.tsx` | First-time setup form (renders `SetupForm`) |
| `/s/[sessionId]/settings` | `settings/page.tsx` | Edit setup (renders the same `SetupForm` with existing values) — labelled "Location & Reminders" in the subnav |
| `/s/[sessionId]/debug` | `debug/page.tsx` | Debug tools panel (gated by `ENABLE_DEBUG_TOOLS`); also rendered as a 404 in the subnav when the flag is off |
| `/s/[sessionId]/not-found` | `not-found.tsx` | Custom 404 for invalid/expired sessions |

The `setup` and `settings` pages share the exact same form component (`SetupForm`); behavioral difference is whether the session already has a saved location.

### API routes (`/api/...`)

| Path | File | Auth | Purpose |
|---|---|---|---|
| `POST /api/sessions` | `api/sessions/route.ts` | rate-limited (20/min/IP) | Create a new anonymous session |
| `GET /api/sessions/[sessionId]` | `api/sessions/[sessionId]/route.ts` | none beyond ID-as-credential | Fetch session row |
| `PATCH /api/sessions/[sessionId]` | same file | none | Save/update setup payload (location, channels, etc.) |
| `POST /api/sessions/[sessionId]/reminders/ack` | `reminders/ack/route.ts` | none | Acknowledge a reminder (toggles `acked` in `SentReminder` ledger) |
| `POST /api/push/subscribe` | `api/push/subscribe/route.ts` | rate-limited | Register a Web Push subscription for a session |
| `POST /api/push/unsubscribe` | `api/push/unsubscribe/route.ts` | rate-limited | Remove a Web Push subscription |
| `GET /api/push/vapid-public-key` | `api/push/vapid-public-key/route.ts` | none | Returns `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for `PushManager.subscribe` |
| `POST /api/recover` | `api/recover/route.ts` | rate-limited (20/min/IP, 8/min/contact) | Send recovery link to the email on a session |
| `GET /api/health` | `api/health/route.ts` | none | Liveness check; runs `SELECT 1` against Postgres |
| **Cron** | | | |
| `GET /api/cron/reminders` | `api/cron/reminders/route.ts` | `Authorization: Bearer $CRON_SECRET` via `verifyCronSecret` | Drives the entire reminder pipeline. Runs four passes: browser, email, persistence, expiry. Externally scheduled (no built-in scheduler). |
| **Debug routes — gated by `ENABLE_DEBUG_TOOLS=true`** | | | |
| `POST /api/debug/simulate-inbound` | `api/debug/simulate-inbound/route.ts` | debug flag + rate-limit | Simulates an inbound STOP/HELP message; calls `handleInbound` directly |
| `POST /api/sessions/[sessionId]/debug/simulate-send` | `debug/simulate-send/route.ts` | debug flag + rate-limit | Triggers a one-off email or push to the session for QA |
| **Reserved** | | | |
| `/api/webhooks/resend/` | (empty directory, no `route.ts`) | — | Placeholder. The actual inbound webhook for Phase 1.2 will land at `/api/inbound/email` per `PLAN.md` §1.2; this directory is currently dead. See "Things to revisit." |

There is **no inbound webhook route in production today.** `handleInbound` exists in `lib/inbound/handle-inbound.ts` and is wired only to the debug simulator. Real inbound email is Phase 1.2.

### Server actions

| File | Function | Used by |
|---|---|---|
| `app/actions/start-session.ts` | `startSessionAction` | `app/page.tsx` "Get started" form |

## Components directory

`src/components/` mixes feature-level components with `components/ui/` (shadcn primitives). Tests live alongside their components (`*.test.tsx`).

### Shadcn UI primitives — used everywhere

| File | Notes |
|---|---|
| `ui/button.tsx`, `ui/card.tsx`, `ui/input.tsx`, `ui/label.tsx` | Standard shadcn-generated; all import `cn` from `@/lib/utils` |

### Feature components and where they're used

| Component | Setup | Dashboard | Settings | Debug | Other |
|---|---|---|---|---|---|
| `setup-form.tsx` | ✓ | | ✓ | | the canonical form for session setup; reused verbatim by both setup and settings |
| `prayer-times-display.tsx` | (via preview) | ✓ | (via preview) | | low-level table of the day's prayers |
| `prayer-times-preview.tsx` | ✓ (inside SetupForm) | | ✓ (inside SetupForm) | | wraps `PrayerTimesDisplay` in a card; rendered inside `SetupForm` once a location is picked |
| `browser-push-hint.tsx` | ✓ (inside SetupForm) | ✓ | ✓ (inside SetupForm) | | prompt to enable browser notifications |
| `share-session-card.tsx` | | ✓ | | | "save your link" reminder card |
| `session-subnav.tsx` | (via layout) | (via layout) | (via layout) | (via layout) | rendered for every `/s/[sessionId]/*` route by the section layout |
| `app-footer.tsx` | (via layout) | (via layout) | (via layout) | (via layout) | rendered on landing, recover, and the session section layout |
| `service-worker-register.tsx` | — | — | — | — | mounted by the **root** layout so it runs on every page |
| `recover-form.tsx` | | | | | only rendered on `/recover` |
| `debug-session-tools.tsx` | | | | ✓ | only rendered on `/s/[sessionId]/debug` |

**Components that are genuinely shared across setup/dashboard/Location & Reminders:**

- `setup-form.tsx` — setup ↔ settings (Location & Reminders), same form, different DB precondition
- `browser-push-hint.tsx` — appears in dashboard *and* indirectly in setup/settings via `SetupForm`
- `prayer-times-display.tsx` — used directly on dashboard, used indirectly on setup/settings via `prayer-times-preview.tsx`
- `session-subnav.tsx` and `app-footer.tsx` — every session page via the section layout
- The `ui/*` shadcn primitives — everywhere

## `lib/` quick orientation

For a full per-file purpose, see `pipeline.md` (Phase 0.3) and `inbound.md` (Phase 0.4). High-level grouping:

- `lib/db.ts` — Prisma client singleton (`getPrisma()`).
- `lib/env.ts` — central env-var accessors (`getEnableDebugTools`, `getReminderNow`, `getSessionValidityDays`, etc.).
- `lib/logger.ts` + `log-sanitize.ts` — structured logger with PII masking.
- `lib/cron-auth.ts` — `verifyCronSecret`.
- `lib/prayer-times.ts` + `prayer-preview.ts` + `prayer-method-options.ts` — adhan-backed prayer computation.
- `lib/calendar-date.ts` — UTC ↔ ymd helpers.
- `lib/normalize.ts` — email normalization.
- `lib/setup-payload.ts` — parse/validate setup form payloads.
- `lib/session-id.ts`, `lib/session-channel-status.ts`, `lib/session-has-location.ts` — session helpers.
- `lib/recover-session.ts` — recovery flow.
- `lib/reminder-cycle.ts` — reminder-cycle row management (per-day-per-session).
- `lib/rate-limit-api.ts` + `rate-limit-memory.ts` — in-process rate limiter.
- `lib/request-ip.ts` — pull client IP from headers.
- `lib/public-url.ts` — base-URL builder for outbound links.
- `lib/timezone-options.ts` — UI dropdown values.
- `lib/message-types.ts` — string constants for message types.
- `lib/debug-notification-tag.ts`, `lib/show-debug-notification.ts`, `lib/push-client.ts` — client-side push helpers.
- `lib/utils.ts` — single export `cn()` (shadcn helper). **Filename violates CLAUDE.md** — flagged below.
- `lib/inbound/handle-inbound.ts` — inbound message handler (STOP/HELP/generic-ack).
- `lib/providers/email.ts`, `web-push.ts` — outbound provider adapters with mock modes.
- `lib/reminders/run-{browser,email,expiry,persistence}-reminders.ts` — the four passes the cron route runs in order. `prayer-reminder-common.ts` is their shared core; `sent-reminder.ts` is the send-ledger helper; `cron-clocks.ts` is QA-clock support.

## Things to revisit

These are observations, not bugs to fix this session. Phase 0 is exploratory.

1. **`src/lib/utils.ts` violates CLAUDE.md naming rules.** It contains only the standard shadcn `cn()` helper, imported by 7 components (`button`, `card`, `input`, `label`, `setup-form`, `prayer-times-display`, `session-subnav`). Renaming is a 0.7 cleanup decision — see the open question in `progress.md`.

2. **`src/app/api/webhooks/resend/` is an empty directory.** No `route.ts`. PLAN.md §1.2 specifies the inbound route as `/api/inbound/email`, not `/api/webhooks/resend`. This directory looks like an abandoned earlier plan. Decide in 0.7: remove now, or leave as a marker until 1.2 lands. See open question in `progress.md`.

3. **`public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`** look like create-next-app boilerplate. Need to confirm none of them are referenced before removing in 0.7.

4. **README.md describes the app as email + browser push only.** That much is accurate, but it does not mention the premium tier, the Phase 1 schema additions, or `mawqit.app`. README will need a substantive rewrite after Phase 1, possibly Phase 2. Not Phase 0 work.

5. **No `vercel.json`** in the repo. PLAN.md §0.6 asks us to identify Vercel project config — there is none. Vercel deployment is presumably configured entirely through the Vercel dashboard. Worth confirming with the project owner during Phase 1.1.

6. **The `calendar` value in the `ReminderChannel` enum** is present in schema, and PLAN.md ships the calendar feed in Phase 2.5. Pre-existing groundwork; do not treat as dead.

7. **`tsconfig.tsbuildinfo` is committed** as a tracked file according to `ls -la`, but `.gitignore` lists `*.tsbuildinfo`. The presence on disk is fine; verify in 0.7 that it's actually ignored by git (`git check-ignore`) and not tracked.

8. **`src/generated/prisma/` is gitignored** but exists locally. This is expected; mentioning so future sessions don't suspect it.
