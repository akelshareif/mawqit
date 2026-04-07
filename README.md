# Mawqit

Prayer-time reminders by **email** and **browser (Web Push)**, tied to a **shareable session link** (no separate login). This repo is a [Next.js](https://nextjs.org) (App Router) app with PostgreSQL and Prisma.

It is currently deployed at the following link: https://mawqit-snowy.vercel.app/
You can [click here](https://mawqit-snowy.vercel.app/) to see Mawqit working live!

## Requirements

- **Node.js** — recent LTS (see `package.json` for the stack).
- **PostgreSQL** — required for sessions, reminders, and message logs.
- **Web Push (real sends)** — use **HTTPS** in production; `localhost` is fine for development. Mock mode logs pushes to the DB without sending.

## Quick start (local)

1. Install dependencies: `npm install`
2. Create **`.env`** in the **project root** (next to `package.json`) — see [Where to change variables](#where-to-change-environment-variables). Start from [`.env.example`](.env.example) and add at least the [minimal set](#minimal-environment-variables) below.
3. Apply the schema: `npm run db:migrate` (or `npx prisma migrate dev`). For a throwaway DB you can use `npm run db:push` instead.
4. Run the app: `npm run dev` and open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server (hot reload). |
| `npm run build` | `prisma generate` + production build. |
| `npm run start` | Run the production server (after `build`). |
| `npm run test` | Vitest unit tests (no database required). |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run lint` | ESLint. |
| `npm run db:generate` | Regenerate Prisma Client. |
| `npm run db:migrate` | `prisma migrate dev` — create/apply migrations in development. |
| `npm run db:push` | `prisma db push` — sync schema without migration files (dev only). |

## Where to change environment variables

| Where | What to do |
|-------|------------|
| **Local development** | Edit **`.env`** in the **repository root** (same directory as [`package.json`](package.json)). If you do not have one yet, copy [`.env.example`](.env.example) to `.env`, then fill in values. Next.js loads this file automatically when you run `npm run dev` or `npm run start`. |
| **Do not commit** | `.env` is for secrets and machine-specific values. Keep it out of git (it should already be in `.gitignore`). |
| **Production (e.g. Vercel)** | Set the same variable **names** in your host's **Environment Variables** / **Secrets** UI for the Production (and Preview, if needed) environment — not by uploading `.env`. |
| **After you change a value** | Restart the dev server (`Ctrl+C`, then `npm run dev`). For **`NEXT_PUBLIC_*`** variables, restart is enough in dev; in production, many hosts **rebuild** the app when those change because they are inlined at build time. |

**Discovering names:** Open [`.env.example`](.env.example) in the repo — every line names a variable the app may use. Your own `.env` can omit keys you do not need (defaults apply in code where documented).

## Minimal environment variables

A small setup can rely on only these (same names in `.env` locally or in the host UI in production):

| Variable | What to put |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string. For SSL (e.g. Neon), prefer **`?sslmode=verify-full`** instead of `sslmode=require` so future `pg` versions match what you expect ([libpq SSL modes](https://www.postgresql.org/docs/current/libpq-ssl.html)). |
| `CRON_SECRET` | Long random string; must match what you send as `Authorization: Bearer <token>` when calling the cron route. |
| `CRON_INTERVAL_MINUTES` | How often your **external** scheduler calls the cron endpoint (e.g. `5`). The app itself does not start a scheduler. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public half of your Web Push VAPID key pair (`npx web-push generate-vapid-keys`). |
| `VAPID_PRIVATE_KEY` | Private half — **server only**, never expose to the client. |

For **real** Web Push delivery (not only logging to the DB), set **`WEB_PUSH_MODE=real`** in `.env` as well; otherwise it defaults to **`mock`**. Add **`VAPID_SUBJECT`** (e.g. `mailto:you@example.com`) for real sends.

**Share links:** If you do not set **`NEXT_PUBLIC_APP_URL`**, the app falls back to **`VERCEL_URL`** on Vercel (auto-set by the platform), then to `http://localhost:3000`. For production, set **`NEXT_PUBLIC_APP_URL`** to your canonical origin (no trailing slash).

**Session expiry** defaults are built into the code (`30` days validity, `3` days warning before expiry). Override with **`SESSION_VALIDITY_DAYS`** and **`SESSION_EXPIRY_WARNING_DAYS`** if needed (see [Optional variables](#optional-and-additional-variables)).

## Optional and additional variables

Everything else is optional for a first run. [`.env.example`](.env.example) lists them with comments. Grouped reference:

### App URL

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Public origin for **share links** (see [minimal section](#minimal-environment-variables) above). Falls back to `VERCEL_URL` on Vercel, then `localhost`. |

### Content and public

| Variable | Purpose |
|----------|---------|
| `LEARN_TO_PRAY_URL` | Link used in inbound **HELP** replies. |
| `NEXT_PUBLIC_DONATE_URL` | If set, footer shows Support / Donate. |

### Email (Resend, optional)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | [Resend](https://resend.com) API key. If unset, outbound email is **mock** (logged to `message_log` only). |
| `RESEND_FROM` | Verified sender, e.g. `Mawqit <noreply@yourdomain.com>`. Required together with `RESEND_API_KEY` for real sends. |
| `EMAIL_FORCE_MOCK` | `true` keeps mock email even when Resend env is set (useful for tests or local development). |

### Web Push (defaults)

| Variable | Purpose |
|----------|---------|
| `WEB_PUSH_MODE` | `mock` (default) — log pushes to `message_log` only; `real` — send when VAPID keys are set. |
| `VAPID_SUBJECT` | VAPID contact (`mailto:` or `https:`); defaults in code if unset. |

### Session expiry

| Variable | Purpose |
|----------|---------|
| `SESSION_VALIDITY_DAYS` | Days a session stays valid after the user saves settings (default `30`). |
| `SESSION_EXPIRY_WARNING_DAYS` | Days before expiry to send the "renew soon" notification (default `3`). |

### Debug and hardening

| Variable | Purpose |
|----------|---------|
| `ENABLE_DEBUG_TOOLS` | `true` enables `/s/{sessionId}/debug` and debug API routes. |
| `ALLOW_DEBUG_TOOLS_IN_PRODUCTION` | Must also be `true` when running debug tools on a production build. Without it, `ENABLE_DEBUG_TOOLS` is ignored and a warning is logged at startup. |

### QA reminder clock (optional, for testing reminder timing)

| Variable | Purpose |
|----------|---------|
| `ENABLE_QA_REMINDER_CLOCK` | `true` applies **`QA_REMINDER_CLOCK_OFFSET_MINUTES`** to cron **reminder** timing only (prayer due and persistence checks). |
| `QA_REMINDER_CLOCK_OFFSET_MINUTES` | Signed integer minutes added to wall time for those checks. Session **expiry** still uses real time. |

When **`ENABLE_DEBUG_TOOLS`** is on, the offset can apply even if **`ENABLE_QA_REMINDER_CLOCK`** is unset (local convenience).

### Optional admin and analytics

`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `PLAUSIBLE_*` — listed in [`.env.example`](.env.example) for optional features; not required for the main reminder flows.

## Testing and QA

### Unit tests

Tests use **Vitest** and **React Testing Library**. Run **`npm test`** once or **`npm run test:watch`** during development. Test files live under `src/` as `*.test.ts` / `*.test.tsx`. They **do not require PostgreSQL** (Prisma and environment are mocked in tests).

### Health

`GET /api/health` — returns JSON; DB check is skipped if `DATABASE_URL` is unset (useful for some CI smoke tests).

### Cron (reminders)

Reminders and expiry jobs run when something calls:

```http
GET /api/cron/reminders
Authorization: Bearer <CRON_SECRET>
```

Example:

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

On your machine, nothing runs this automatically — use an external scheduler in production (e.g. [cron-job.org](https://cron-job.org)) or run `curl` while developing. Interval should align with **`CRON_INTERVAL_MINUTES`** (default 5).

### Debug UI

When **`ENABLE_DEBUG_TOOLS=true`** (and in production, **`ALLOW_DEBUG_TOOLS_IN_PRODUCTION=true`**):

- Open **`/s/{sessionId}/debug`** — **message log** (newest first), **outbound** tests, **inbound** tests, and a short explanation of how each relates to production code paths.
- **Outbound email:** Uses **Resend** when **`RESEND_API_KEY`** and **`RESEND_FROM`** are set; otherwise **mock** (rows in `message_log` only). For development without a verified domain, Resend allows **`onboarding@resend.dev`** as `RESEND_FROM` with recipient restrictions — see [Resend docs](https://resend.com/docs).
- **Outbound browser notifications:** The debug API uses **real Web Push** when VAPID keys are set, **even if** **`WEB_PUSH_MODE=mock`** (so cron can stay mock while you test delivery). After a successful send, the page also triggers a **visible** OS notification so alerts show even when the tab is focused.
- **Quick tests** — buttons send email or browser notifications with **"due in ~15s"** copy; **plain** tests use generic copy. **Inbound** presets (**STOP**, **HELP**, **Thanks**) plus custom body; **From** must match the session's saved email for routing.
- **`POST /api/debug/simulate-inbound`** — same as the debug form (gated by debug tools).
- **QA reminder clock** — env vars **`ENABLE_QA_REMINDER_CLOCK`**, **`QA_REMINDER_CLOCK_OFFSET_MINUTES`**, or **`ENABLE_DEBUG_TOOLS`** shift **`reminderNow`** for cron only; session **expiry** still uses wall clock.

### Manual QA

Before release, exercise at least: prayer **email** reminders; **Web Push** sends and subscription cleanup (410/404); **expiry** warning and day-of notices; **STOP** / **HELP** / **ack** on email; Web Push **ack** actions where supported; **session save** and **share link**. For reminder timing without waiting for real salah times, use the **QA reminder clock** variables above and trigger the cron route as needed.

### Checks

- `npm run test`
- `npm run lint`
- `npm run build`

## Using the running app

1. **Landing** — **Get started** creates a new session and sends you to **Setup**.
2. **Setup** — Enter location (coordinates + timezone), enable **email** and/or **browser notifications**, persistence options, and calculation method. **Timezone** dropdown lists a **short curated set** (US, Canada, Mexico, Caribbean, Hawaii); any valid **IANA** name is still allowed via **Enter manually**. **Save** extends the session and opens the **Dashboard**. Page title: **Set up Reminders**.
3. **Session URL** — Visiting **`/s/{sessionId}`** (no sub-path) **redirects to the Dashboard**. If latitude/longitude/timezone are not saved yet, the dashboard shows **placeholders** for prayer times and the share link; use **Location & Reminders** to finish setup.
4. **Dashboard** — Today's prayer times, next prayer, **share link** (copy/bookmark). Before location is saved, shows placeholder prayer times and session link sections. Subnav: **Mawqit** (logo, always brand color), **Home** (always visible), **Location & Reminders** (setup + settings), and **Debug** (when debug tools are enabled).
5. **Location & Reminders** — Same form as setup for editing; page title **Location & Reminders**; saving extends the session again.
6. **Browser notifications** — Enable the checkbox on Setup or Location & Reminders, then **Enable notifications on this device** (saves your settings if needed, then requests permission and subscribes Web Push). In **`WEB_PUSH_MODE=mock`**, sends are logged to `message_log` only.
7. **Reminders** — Prayer reminders are sent when the **cron** runs **after** each prayer time has passed (see [Cron](#cron-reminders)). With **`RESEND_API_KEY`** and **`RESEND_FROM`**, email goes through **Resend**; otherwise it is mock-only (still logged to `message_log`).
8. **Lost your link?** — Only on the **landing** page (not in the session footer). **`/recover`** asks for the **email** on your session; **`POST /api/recover`** looks up the session, rate-limits by IP and contact, and sends the link (Resend when configured; otherwise mock email, logged to `message_log`). The UI always shows the same success copy regardless of whether a match was found (no account enumeration).
9. **Delete my data** — On **Setup** or **Location & Reminders**, after you have saved location at least once, a **Delete my data** card appears. **`DELETE /api/sessions/[id]`** removes the session and related rows (cascade).
10. **Footer** — Optional **Support / Donate** when `NEXT_PUBLIC_DONATE_URL` is set (same footer on landing and inside a session).

## Deployment

Deploy like any Next.js app (e.g. [Vercel](https://vercel.com/docs/frameworks/nextjs)). In the host's env UI, set the same keys as in your local [`.env`](#where-to-change-environment-variables) — at minimum the [minimal set](#minimal-environment-variables), plus **`NEXT_PUBLIC_APP_URL`** for correct share links. Run **`npx prisma migrate deploy`** against your production database before the first request. Keep **`ENABLE_DEBUG_TOOLS`** off in production unless you intentionally enable debug tooling (see [Debug and hardening](#debug-and-hardening)).

## Further reading

- [Next.js documentation](https://nextjs.org/docs) — framework reference.
- [Mawqit Technical Documentation](./mawqit_technical_doc.md) - reference for all technical implementations.
