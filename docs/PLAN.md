# Mawqit Production Migration Plan

Migrating Mawqit from a class project to a production web app with free and paid tiers, donations, and a friends-and-family-first launch.

## Decisions locked in

| Item | Decision |
|---|---|
| Domain | `mawqit.app` |
| Free tier name | Mawqit |
| Paid tier name | Mawqit+ |
| Pricing | $2.99/mo · $7.99/quarter · $14.99/6-month · $24.99/year |
| Renewal model | **Affirmative renewal** — user clicks email link to renew, never auto-renew |
| Free tier session validity | 30 days |
| Paid tier session validity | 180 days |
| Donations | Stripe Payment Links: $5 / $10 / $25 / custom, plus secondary LaunchGood link |
| Launch sequence | Friends-and-family → social media → masjid outreach |
| Account model | Anonymous sessions across both tiers; Stripe customer is the recovery anchor |

## What's deliberately out of scope

Documenting these so they don't creep in:

- White-label or organization tier
- Family plans
- Native mobile apps
- Streak tracking, completion verification, or any gamification
- WhatsApp delivery
- Calendar two-way sync (only outbound .ics feed)
- Adhan audio in browser push (defer to v1.1)
- Ramadan-specific features (defer to v1.1, ship before next Ramadan)

## Premium feature set (Mawqit+)

Locked in for v1 paid tier:

1. Calendar feed (.ics subscription URL)
2. Custom reminder copy (per-prayer and global, with token substitution)
3. Extended session validity (180 days vs 30)
4. Multi-location (up to 3 saved locations, one active)
5. Multi-recipient email (up to 3 email addresses)
6. **SMS reminders** with smart per-prayer toggle and 100/month hard cap (ships in Phase 3)

---

## Phase 0: Exploratory pass and cleanup

**Goal:** Claude Code reads the repository thoroughly, produces a written map of how the codebase actually works, and removes dead code and unused items. The exploration outputs are documentation that subsequent phases will rely on. The cleanup must be behavior-preserving — no functional changes, no logic edits, no schema changes.

This phase exists because every later phase makes assumptions about where code lives, how the cron loop is structured, how the inbound logic is wired, what the Prisma schema currently captures, and what tests already cover. Getting those assumptions wrong wastes hours later. And because dead code in the repo will cause Claude Code to make worse decisions in every subsequent phase.

### 0.1 Repository orientation
- List top-level directories with one-line purposes
- Identify the App Router structure: which routes are public, which are session-scoped (`/s/[sessionId]`), which are API routes
- Identify the cron route, the inbound webhook route (if any), the recovery route, the debug routes
- Map the components directory: which components are reused across setup, dashboard, and Location & Reminders

### 0.2 Schema audit
- Read `prisma/schema.prisma` and list every model with its key fields
- Identify cascade rules and indexes
- Note which fields are currently single-value but will become one-to-many in Phase 1 (recipients, locations)
- Document existing migrations in `prisma/migrations/`

### 0.3 Reminder pipeline trace
- Trace what happens from `GET /api/cron/reminders` through to a delivered email or push
- Document: how prayer times are computed, how due reminders are selected, how idempotency is enforced via the send ledger, how persistence cycles are tracked, how follow-ups are scheduled, how 410/404 push subscription cleanup works
- Identify all places that read `WEB_PUSH_MODE` and similar env switches

### 0.4 Inbound and channel logic
- Find `handleInbound` and document what STOP, HELP, and generic-ack do today
- Note exactly where it is wired (debug simulator only? real webhook?)
- Document the channel-status model (per-session toggles for email, push, future SMS)

### 0.5 Test coverage map
- Run `npm test` and capture output
- List which areas have unit tests and which don't
- Flag gaps that Phase 1 will need to fill (Asr juristic methods, DST, high-latitude, premium gating)

### 0.6 Environment and deployment
- Read `.env.example` and reconcile against the README's documented variables
- Note any drift between code and docs
- Identify Vercel project configuration if present (`vercel.json`, etc.)

### 0.7 Repo cleanup (behavior-preserving)

After 0.1–0.6 are written up, do a focused cleanup pass. **Cleanup must not change behavior.** If anything is borderline, leave it alone and flag it as an open question instead.

Things to remove or fix:
- Unused imports
- Commented-out code blocks
- Dead exports — symbols exported but never imported anywhere
- Unused dependencies in `package.json` (verify with `depcheck` or equivalent before removing)
- Leftover debug code, `console.log` statements that should be structured logs
- Unused environment variables in `.env.example` that are no longer read by the code
- Orphan test files for code that no longer exists
- Empty directories
- Dotfiles or scaffolding files left over from `create-next-app` that aren't actually used
- `TODO`/`FIXME` comments older than 90 days that are no longer relevant (verify with the project owner before removing if unsure)

Things **not** to touch in this pass:
- Anything that would change runtime behavior, even subtly
- Anything that requires schema changes
- Anything that requires running migrations
- Refactors of working code, even if they look "weird" — file an open question instead
- Anything that touches the cron pipeline, the send ledger, or the inbound handler

The cleanup ships as a single PR titled `chore: phase 0 cleanup` with a clear summary of what was removed and why. The PR description must include the output of `npm test`, `npm run lint`, and `npm run build` showing no regressions.

### 0.8 Outputs of Phase 0

Claude Code writes the following files into `docs/context/`:

- `repo-map.md` — directory structure with one-line purpose per top-level item
- `schema.md` — current Prisma models, fields, relationships
- `pipeline.md` — reminder pipeline trace with file references
- `inbound.md` — inbound logic state and gaps
- `tests.md` — current coverage and gaps
- `env.md` — env var reconciliation
- `cleanup.md` — what was removed in 0.7 and why

These files are persistent context for every later session. They get updated whenever the relevant code changes.

### Phase 0 acceptance gate

You read through `docs/context/*.md` and confirm it matches your mental model of the codebase. Anything wrong gets corrected. The cleanup PR is reviewed and merged. **No Phase 1 work begins until both gates pass.**

---

## Phase 1: Production hardening

**Goal:** A stranger can land on mawqit.app, sign up, save settings, and reliably receive prayer reminders by email and browser push for at least a month with zero intervention. STOP and HELP work on real inbound email. You get notified when something breaks.

### 1.1 Domain and email infrastructure
- Register `mawqit.app` (Cloudflare Registrar or Porkbun)
- DNS in Cloudflare; Vercel custom domain configured
- Resend domain verification with DKIM, SPF, DMARC
- `RESEND_FROM` updated to a verified sender on the new domain (e.g., `Mawqit <reminders@mawqit.app>`)
- `NEXT_PUBLIC_APP_URL` updated to `https://mawqit.app`
- **Done means:** real test email from production lands in inbox (not spam) on Gmail, Outlook, Yahoo, and iCloud

### 1.2 Wire inbound email
- Configure Resend inbound webhook to a new route `/api/inbound/email`
- Connect existing `handleInbound` logic to the webhook payload format
- Verify request signatures from Resend
- **Done means:** replying STOP from a real email account to a real reminder disables that channel for that session in production

### 1.3 Prayer-time correctness
- Surface Asr juristic method (Standard vs Hanafi) in setup form
- Surface high-latitude rule selection (Middle of Night / Seventh of Night / Twilight Angle)
- DST transition test pass for US/Canada timezones
- Verify Hijri date computation if displayed
- **Done means:** unit test coverage for Asr Hanafi, DST spring-forward, DST fall-back, and a high-latitude case

### 1.4 Schema migration for production and future premium

Lands in Phase 1 even though premium features are Phase 2 — the data model is more painful to change later than to get right now.

New tables:

- `subscriptions` — one-to-one with session: `stripe_customer_id`, `stripe_subscription_id` (nullable, since we use one-time payments), `tier`, `status`, `period_end`, `last_renewed_at`
- `saved_locations` — one-to-many from session: `name`, `lat`, `lng`, `timezone`, `is_active`
- `notification_recipients` — one-to-many from session: `type` (email | sms), `value`, `is_primary`, `verified_at`
- `donations` — log only: `stripe_session_id`, `amount`, `currency`, `created_at`

Migrate existing single-value email and location fields onto the new tables as the primary/active row. Maintain backward compatibility during the rollout.

- **Done means:** Prisma migration applied, existing sessions preserved, all reads and writes go through the new tables

### 1.5 Observability
- Sentry on both server and client (free tier)
- Uptime monitor pinging `/api/health` and `/api/cron/reminders` every 5 min (Better Stack or Cronitor free tier)
- Internal admin page at `/admin` (password-protected via `ADMIN_PASSWORD`) showing: last 24h delivery counts by channel, failed sends, sessions expiring in 7 days, last cron run timestamp
- Structured logging on cron runs with session count and per-channel success/fail
- **Done means:** you receive an alert if cron has not run in 15 min, or if error rate spikes

### 1.6 Legal and data
- Privacy Policy page (the data story is strong: anonymous sessions, no tracking, delete-my-data already works)
- Terms of Service
- Plain-language "How your data is handled" page
- No cookie banner unless non-essential cookies are set
- Footer links to all three on every page
- **Done means:** all three pages live, linked from footer, mention CCPA and GDPR data rights

### 1.7 Rate limiting and abuse hardening
- Rate limit on `POST /api/sessions` (anonymous can spawn unlimited sessions today)
- Verify recovery rate limit is tight per IP and per contact
- Rate limit on push subscribe and unsubscribe endpoints
- Lock down debug routes: `ENABLE_DEBUG_TOOLS=false` in production
- **Done means:** load test confirms rate limits trigger correctly; debug routes return 404 in production

### 1.8 Friends-and-family feedback channel
- `/feedback` form posting to a `feedback` table or sending to your inbox via Resend
- Linked from dashboard footer
- **Done means:** users can send feedback in two clicks from anywhere in the app

### Phase 1 acceptance gate

At least 5 friends-and-family users on the system for 2+ weeks with no critical issues, and at least 3 confirming reminders fire reliably for all 5 prayers. **Phase 2 does not start until this is true.**

---

## Phase 2: Mawqit+ tier (no SMS yet)

**Goal:** Users can pay for Mawqit+ via Stripe, premium features unlock immediately, the affirmative renewal flow works end-to-end, and donations are accepted.

### 2.1 Stripe foundation
- Stripe account in production mode, business details for tax handling
- Products and prices in Stripe: `mawqit_plus_monthly` ($2.99), `mawqit_plus_quarterly` ($7.99), `mawqit_plus_6month` ($14.99), `mawqit_plus_yearly` ($24.99)
- All configured as **one-time payments**, not subscriptions (this is critical — affirmative renewal, not auto-renew)
- Webhook endpoint `/api/stripe/webhook` with signature verification
- Handle `checkout.session.completed`

### 2.2 Checkout flow
- `/s/[sessionId]/upgrade` page showing tier comparison and four billing options
- Checkout creates Stripe session with `metadata.session_id` and `metadata.tier`
- Success URL → `/s/[sessionId]?upgraded=true` with celebration UI
- Cancel URL → back to upgrade page
- Webhook writes to `subscriptions` table with `customer_id`, `tier`, computed `period_end`, `status='active'`
- **Done means:** test card $2.99 charge produces a dashboard showing "Mawqit+ until [date]"

### 2.3 Affirmative renewal flow

This is the unusual part and needs care. Add to existing cron logic:

- 7 days before `period_end`, send renewal-confirm email with a signed JWT containing `session_id` and target tier
- Token route `/renew/[token]` validates signature, presents Stripe Checkout for the same tier (Stripe charges saved card if customer chose to save it; otherwise re-collects)
- On successful charge, extend `period_end` by tier length, mark `last_renewed_at`
- 1 day before `period_end` if no renewal yet, send a final reminder
- Day after `period_end` with no renewal: downgrade to free (set `status='expired'`), send "your Mawqit+ has ended, settings preserved" email
- **Done means:** test sub purchased with `period_end` artificially set to 8 days out, renewal email arrives, click-through extends period

### 2.4 Premium feature gate helper
- `isPremium(session): boolean` reading from `subscriptions` where `status='active'` and `period_end > now`
- Used everywhere features branch
- Returns false on lapsed or expired so degradation is automatic
- **Done means:** unit tests for active, expired, never-paid, future-period-end edge cases

### 2.5 Premium features

**Calendar feed (.ics)**
- Endpoint `/s/[sessionId]/calendar.ics?token=[signed]` returning generated ICS
- Contains all 5 prayers for the next 90 days, computed live from session location and method
- Signed token prevents enumeration; rotate-able from settings
- Premium-gated; free users see the feature in UI but it's behind an upgrade prompt
- **Done means:** subscribe URL works in Apple Calendar, Google Calendar, and Outlook; new prayers appear automatically as the feed refreshes

**Custom reminder copy**
- Per-prayer custom message field (max 500 chars) plus a global custom message field
- Per-prayer override beats global if both are set
- Token substitution: `{prayer}`, `{time}`, `{location}`
- Premium-gated; free users get default copy
- **Done means:** "It's {prayer} time at {time}, may Allah accept your prayer" renders correctly in email and push

**Extended session validity**
- Free: 30 days (current behavior)
- Premium: 180 days
- Set on save action based on premium status at save-time
- **Done means:** new save while premium sets 180-day expiry; saving again while still premium re-extends

**Multi-location**
- UI on Location & Reminders page: list of saved locations with "Set active" button
- Up to 3 saved locations on premium, 1 on free
- Active location drives reminder calculations
- **Done means:** user can save Home / Office / Travel locations and switch which is active in one click

**Multi-recipient (email only in Phase 2)**
- Up to 3 email recipients on premium, 1 on free
- Each gets the same reminder
- Verification email sent to new addresses before they receive reminders
- **Done means:** adding a second email triggers verification; both addresses receive Fajr reminder after verification

### 2.6 Donations
- `/support` page with $5 / $10 / $25 / custom buttons
- Each button is a Stripe Payment Link in donation mode (no account, no recurring)
- Below buttons: "Or donate via LaunchGood" with link to your LaunchGood campaign
- Footer link from every page when `NEXT_PUBLIC_DONATE_URL` is set (already wired)
- Webhook logs donations to `donations` table for your records
- **Done means:** $5 donation completes in three clicks from any page

### 2.7 Upgrade prompts and feature discovery

Don't be aggressive. The thesis is anti-friction.

- Subtle "Mawqit+" badge next to locked features
- Click locked feature → modal explaining what it does and the price
- Single "Upgrade" link in dashboard sidebar
- No interstitials, no popups, no email nags

### Phase 2 acceptance gate

At least 5 friends-and-family users have completed the upgrade flow successfully (cards refunded after), at least 1 has gone through the renewal email flow, donations have been tested end-to-end. **Phase 3 does not start until this is true.**

---

## Phase 3: Pre-public-launch

### 3.1 SMS via Twilio
- A2P 10DLC: Sole Proprietor Brand registration (~$4.50 one-time), low-volume campaign vetting (~$15 one-time + ~$2/mo)
- Local 10DLC phone number (~$1.15/mo)
- `WEB_SMS_MODE=mock|real` env var matching the existing email/push pattern
- `handleInbound` extended for Twilio inbound webhook (STOP and HELP via SMS)
- Phone number verification flow (send OTP, confirm before reminders fire)
- A2P 10DLC compliance language in setup ("Reply STOP to unsubscribe, HELP for help, msg & data rates may apply")
- **Done means:** registered campaign approved by carriers, real SMS sends to a real phone

### 3.2 SMS feature configuration
- Per-prayer SMS toggle in setup
- Hard cap: 100 SMS sent per calendar month per session
- When cap is hit, SMS is skipped silently; reminder still goes via email or push if enabled
- Persistence resends and follow-ups never use SMS — always email or push
- Multi-phone (up to 2 phones on premium) within the shared 100/mo cap
- **Done means:** capped user past 100 sends in a month receives 0 additional SMS but reminders still fire via other channels

### 3.3 i18n
- next-intl or similar
- Languages for v1: English, Arabic (RTL), Urdu
- Translate UI strings, email templates, push notification copy, ICS calendar event titles
- Hijri date display (now serves both UI and premium calendar feed)
- **Done means:** user can switch language in settings, all reminder content arrives in chosen language

### 3.4 Marketing and SEO surface
- Landing page polish (current is functional, not marketing-grade)
- FAQ page (especially: "why do I need to confirm renewal?", "is my data safe?", "what if I lose my link?")
- Comparison page (Mawqit vs other prayer apps — emphasize web-first, no app, no tracking)
- OG images, favicon, web manifest
- Meta tags, sitemap, robots.txt
- Plausible analytics (already in env vars) — privacy-respecting

### 3.5 Pre-launch QA
- Manual QA against full README checklist
- Stripe test cards across all 4 sub durations and the renewal flow
- Inbound email STOP/HELP end-to-end on real domain from Gmail, Outlook, iCloud
- Inbound SMS STOP/HELP end-to-end
- Cron load test at 100, 500, 1000 sessions
- Session expiry warning emails
- Downgrade-on-non-renewal preserves user settings
- **Done means:** signed-off QA log with each scenario tested

### 3.6 Masjid outreach kit
- One-page PDF describing Mawqit for imams (the term paper is most of this)
- Bulk discount codes (e.g., 50% off yearly for masjid members)
- Email template for masjid admins to forward to members

---

## Suggested execution order

1. **Phase 0 in full.** Don't skip. Don't compress.
2. Phase 1.4 (schema) before any other Phase 1 work.
3. Phase 1.1 + 1.2 (domain + inbound email) — needed to test anything else realistically.
4. Phase 1.5 (observability) — you want this watching everything else as it ships.
5. Phase 1.3, 1.6, 1.7, 1.8 — parallelizable.
6. **Pause for friends-and-family run. Do not skip this gate.**
7. Phase 2.1 → 2.6 in tight loop.
8. **Pause for paid friends-and-family run.**
9. Phase 3 in order. SMS last because A2P registration takes 10–15 days carrier review.
