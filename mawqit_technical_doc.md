---
name: Mawqit Current Build
overview: Production-only reference for the Mawqit system as it exists in the codebase and deployed app. This document excludes planned or optional features from the broader plan doc and focuses only on implemented behavior, constraints, and development tradeoffs.
---

# Mawqit: Current Built System

## Purpose

This document is a production-focused companion to `mawqit_plan.md`.

It is intended for another AI agent that needs to understand what Mawqit actually does today, not what was proposed earlier in the broader plan. Treat this as the authoritative summary of the implemented system as of the current codebase.

The document deliberately avoids speculative or optional roadmap items. If a feature is not described here, it should not be assumed to be part of the shipped product.

## One-paragraph summary

Mawqit is a web application for Islamic prayer reminders that uses an anonymous, shareable session link instead of end-user accounts. Users create a session, save a location, choose a prayer calculation method, and enable one or both implemented notification channels: email and browser notifications (Web Push). Reminder delivery is driven by a cron endpoint that computes prayer times locally with `adhan`, sends initial reminders, optional persistence resends, optional follow-ups, and separate session-expiry notices. The app includes a recovery flow, a delete-my-data flow, a session-scoped debug page, and a QA reminder clock for manual testing.

## Implemented product scope

### Built and active

- Anonymous session-based access using a long random session ID in the URL.
- Landing page with "Get started" and "Lost your link?"
- Setup and settings flow for:
  - location
  - timezone
  - prayer calculation method
  - email reminders
  - browser notifications
  - persistence cadence
  - follow-up delay
- Dashboard showing today’s prayer times, next prayer, and the session link.
- Placeholder dashboard state when setup is incomplete.
- Email delivery through Resend when configured, otherwise mock logging.
- Browser notifications through Web Push when configured, otherwise mock logging.
- Cron-driven reminder sending.
- Session expiry warning and day-of-expiry reminder.
- Recovery flow for sending the session link again.
- Delete-my-data flow for deleting a session and related records.
- Session-scoped debug tools for outbound and inbound simulation.
- Browser notification acknowledgment endpoint and service worker actions.

### Not part of the current built product

The current deployed product should be understood as an email-plus-browser reminder system with session links. Features that appeared in the broader plan but are not part of this document should be treated as unbuilt for paper-writing purposes.

## Core user model

### Authentication model

There is no traditional user account, password, or login.

The session URL is the credential:

- `POST /api/sessions` creates a session row and returns an ID.
- The canonical share URL is `https://<public-origin>/s/<sessionId>`.
- Opening that URL gives access to the same session on any device.
- Session URLs are therefore security-sensitive and should be treated like bearer secrets.

### Session lifecycle

- A new session starts mostly empty.
- The user saves location and channel preferences through setup.
- Each successful save extends the session expiration window.
- Default session validity is 30 days unless changed by env.
- When a session expires, prayer reminders stop until the user saves again.

## User-facing routes

### Public routes

- `/`
  - landing page
  - creates a session on "Get started"
  - links to `/recover`

- `/recover`
  - recovery form
  - asks for the contact the user used when setting up reminders
  - returns generic success copy regardless of whether a match exists

### Session routes

- `/s/[sessionId]`
  - always redirects to `/s/[sessionId]/dashboard`

- `/s/[sessionId]/setup`
  - first-time configuration
  - page heading: "Set up Reminders"

- `/s/[sessionId]/settings`
  - editing screen for an existing session
  - navigation label: "Location & Reminders"

- `/s/[sessionId]/dashboard`
  - today’s prayer times
  - next prayer
  - shareable session link
  - browser subscription hint when browser notifications are enabled but no subscription exists

- `/s/[sessionId]/debug`
  - shown only when debug tools are enabled
  - message log
  - simulate outbound email
  - simulate outbound browser notification
  - simulate inbound STOP / HELP / acknowledgment

### Navigation behavior

The session sub-navigation reflects implemented behavior rather than the older plan:

- `Mawqit` wordmark links to the dashboard.
- `Home` is always visible.
- `Location & Reminders` is the label for both setup and settings.
- `Debug` appears only when debug tools are enabled.
- The wordmark uses brand styling and is never shown as the active-page treatment.

## Implemented API surface

These are the currently implemented application endpoints that matter to the built product:

- `POST /api/sessions`
  - create a new anonymous session

- `GET /api/sessions/[sessionId]`
  - fetch session data for an existing session

- `PATCH /api/sessions/[sessionId]`
  - save setup/settings
  - extends session expiry
  - syncs channel status rows

- `DELETE /api/sessions/[sessionId]`
  - delete a session and related data

- `POST /api/recover`
  - send the session link again using the configured outbound provider

- `GET /api/cron/reminders`
  - authenticated cron entrypoint for expiry, initial reminders, and persistence/follow-up

- `POST /api/push/subscribe`
  - store or update a browser push subscription for a session

- `POST /api/push/unsubscribe`
  - remove a browser push subscription

- `GET /api/push/vapid-public-key`
  - returns the browser-safe VAPID public key

- `POST /api/sessions/[sessionId]/reminders/ack`
  - mark a browser reminder cycle as acknowledged

- `POST /api/debug/simulate-inbound`
  - debug-only inbound simulator

- `POST /api/sessions/[sessionId]/debug/simulate-send`
  - debug-only outbound simulator

- `GET /api/health`
  - lightweight health endpoint

## Implemented setup flow

### Required inputs

The setup payload currently requires:

- latitude
- longitude
- timezone
- at least one enabled notification channel: email or browser
- a valid prayer method
- persistence cadence
- follow-up delay

### Current channel reality

The setup parser enforces only two real channels:

- email
- browser notifications

Although some schema fields and helper branches still mention SMS, the implemented setup flow hard-codes:

- `smsEnabled = false`
- `phoneNumber = null`

So the deployed product should be described as an email-and-browser system, not an SMS product.

### Prayer calculation options

The built UI exposes these prayer methods:

- Muslim World League
- ISNA
- Egyptian
- Umm Al-Qura
- Moonsighting Committee (North America)

Prayer times are computed locally in the app with `adhan`, not through an external prayer-time API.

### Timezone behavior

The built timezone UX intentionally narrowed scope:

- the dropdown shows a curated Americas-only list
- users can still manually enter any valid IANA timezone

The current curated list includes:

- `Pacific/Honolulu`
- `America/Anchorage`
- `America/Los_Angeles`
- `America/Phoenix`
- `America/Denver`
- `America/Chicago`
- `America/New_York`
- `America/Toronto`
- `America/Vancouver`
- `America/Edmonton`
- `America/Winnipeg`
- `America/Halifax`
- `America/Mexico_City`
- `America/Puerto_Rico`

## Implemented reminder channels

### Email

Email is a built channel.

Behavior:

- If `RESEND_API_KEY` and `RESEND_FROM` are set, the app sends email via Resend.
- If those values are not set, the app uses a mock email provider that writes to `message_log`.
- `EMAIL_FORCE_MOCK=true` forces mock behavior even if Resend is configured.

Email is used for:

- prayer reminders
- persistence resends
- follow-ups
- expiry warnings
- expiry day reminders
- recovery link delivery
- debug simulate-send
- outbound HELP / STOP / acknowledgment responses inside `handleInbound`

### Browser notifications

Browser notifications are also a built channel.

Behavior:

- The client registers a service worker.
- The user must grant browser notification permission.
- The app stores one row per subscribed device in `push_subscriptions`.
- Cron sends one Web Push notification per subscribed device.
- Expired subscriptions are removed on `410` or `404` responses.

Browser notification delivery can run in:

- mock mode: log only
- real mode: actual `web-push` sends using VAPID keys

The dashboard and setup/settings UI allow the user to enable browser notifications and complete subscription on the current device.

## Reminder delivery model

### Cron entrypoint

Reminder work is driven by:

- `GET /api/cron/reminders`

This route requires:

- `Authorization: Bearer <CRON_SECRET>`

The route runs four passes:

1. expiry pass
2. initial email reminder pass
3. initial browser reminder pass
4. persistence/follow-up pass

### Reminder cadence

The application does not schedule its own jobs.

An external scheduler must call the cron route on a configured interval:

- `CRON_INTERVAL_MINUTES`
- default: 5 minutes

This means reminder delivery is not exact to the second. A prayer becomes eligible at its computed time and will be sent on the first cron tick at or after that time.

### Initial prayer reminders

For each active, non-expired session with required location data:

- the app computes today’s prayer times in the session timezone
- it checks each salah in order
- if the prayer time has passed, it attempts an idempotent send

Idempotency is implemented through `sent_reminders`.

### Persistence resends

Persistence is built and enabled by default.

Implemented behavior:

- one initial reminder starts a reminder cycle
- if the user has not acknowledged the prayer, the cycle can resend on a selected cadence
- allowed cadence values are 5, 15, or 30 minutes
- the system caps resend count per cycle
- stale cycles are skipped once the prayer window is no longer relevant

### Follow-up behavior

Follow-up is separate from persistence.

Implemented behavior:

- it is optional per session
- allowed delays are 15, 30, or 60 minutes
- only one follow-up is sent per cycle
- acknowledgment stops further sends

### Session-expiry reminders

Expiry is also part of the built system.

Implemented behavior:

- sessions are marked expired when `expiresAt <= now`
- active sessions nearing expiry receive a warning notice
- active sessions on their calendar day of expiry receive a day-of-expiry notice
- both notices can go out over email and browser notifications
- when a user saves settings again, expiry flags are reset and the session becomes active again

## Acknowledgment, STOP, and HELP

### Browser acknowledgment

Browser reminders support implemented acknowledgment behavior.

The service worker:

- shows prayer notifications
- includes notification actions when enough metadata is present
- posts to `/api/sessions/[sessionId]/reminders/ack`

That API marks the matching browser reminder cycle as acknowledged.

### Text-based inbound logic

The app has implemented `handleInbound` logic for:

- `STOP`
- `HELP`
- any other reply as acknowledgment

Behavior:

- `STOP` disables that channel in `channel_status`
- `HELP` sends back the session link plus `LEARN_TO_PRAY_URL`
- any other reply marks the latest open reminder cycle as acknowledged

Important current limitation:

- this logic exists and works through the debug simulator
- it is not wired to a live production inbound email webhook
- it is therefore best described as implemented application logic, but not fully live as a production reply-to-email pipeline

For paper-writing purposes, HELP/STOP/ack should be described as:

- implemented and testable in-app through debug tooling
- not currently backed by a deployed real inbound mail provider flow

## Recovery flow

Recovery is built and shipped.

Behavior:

- `POST /api/recover`
- rate-limited by IP
- rate-limited by contact
- normalizes contact input
- returns the same generic response whether a session matched or not
- sends the recovery link through the configured outbound provider

In practical user terms, the recovery flow is email-centered because the built setup flow stores email and browser choices, not SMS setup data.

## Delete-my-data flow

Delete-my-data is built.

Behavior:

- once a session has been saved, the setup/settings UI shows a delete card
- `DELETE /api/sessions/[sessionId]` removes the session
- related rows cascade-delete with Prisma relations

There is no separate emailed delete-token flow in the current build.

## Debug and QA tooling

### Debug page

The debug page is a real part of the current system, though usually disabled in production.

It includes:

- newest-first message log
- email simulate-send
- browser simulate-send
- inbound simulation from a saved address
- preset inbound bodies: `STOP`, `HELP`, and a generic acknowledgment such as `Thanks`

### Debug send behavior

Implemented debug behavior differs slightly from cron by design:

- debug email uses the same email provider selection as production
- debug browser send forces real Web Push when VAPID keys exist, even if cron is still in mock mode
- after a successful debug browser send, the client also shows a visible notification banner using the Notification API or service worker

This was added to make testing easier when the tab is focused and to validate device-level delivery without changing the cron channel mode.

### QA reminder clock

The app includes a built QA reminder clock for manual testing.

It shifts only reminder evaluation time, not session expiry time.

Relevant env:

- `ENABLE_QA_REMINDER_CLOCK`
- `QA_REMINDER_CLOCK_OFFSET_MINUTES`
- `ENABLE_DEBUG_TOOLS` also enables the shifted clock behavior locally

This allows cron reminder behavior to be tested without waiting for real prayer times to occur.

## Data persisted in PostgreSQL

The current built system relies on these core tables:

- `sessions`
  - location
  - timezone
  - enabled channels
  - persistence settings
  - prayer method
  - expiry state

- `push_subscriptions`
  - one row per subscribed browser/device

- `reminder_cycles`
  - per-session, per-channel, per-prayer cycle state
  - acknowledgment status
  - follow-up status
  - resend count

- `sent_reminders`
  - idempotency ledger for sends

- `channel_status`
  - whether a channel has been disabled, such as by STOP

- `message_log`
  - outbound and inbound records
  - used heavily for mock flows and debugging

- `cron_runs`
  - operational visibility for reminder runs

## Environment variables that matter for the built system

### Core

- `DATABASE_URL`
- `CRON_SECRET`
- `CRON_INTERVAL_MINUTES`
- `SESSION_VALIDITY_DAYS`
- `SESSION_EXPIRY_WARNING_DAYS`

### Public URL generation

- `NEXT_PUBLIC_APP_URL`
- `VERCEL_URL` fallback

If `NEXT_PUBLIC_APP_URL` is not set:

- Vercel deployments fall back to `https://$VERCEL_URL`
- local development falls back to `http://localhost:3000`

### Email

- `RESEND_API_KEY`
- `RESEND_FROM`
- `EMAIL_FORCE_MOCK`

### Browser notifications

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `WEB_PUSH_MODE`

### Inbound HELP message

- `LEARN_TO_PRAY_URL`

### Debug / QA

- `ENABLE_DEBUG_TOOLS`
- `ALLOW_DEBUG_TOOLS_IN_PRODUCTION`
- `ENABLE_QA_REMINDER_CLOCK`
- `QA_REMINDER_CLOCK_OFFSET_MINUTES`

## Architecture summary

The implemented architecture is intentionally compact:

- Next.js App Router for pages and API routes
- PostgreSQL with Prisma
- `adhan` for local prayer-time calculation
- Resend for real email when configured
- `web-push` for real browser notifications when configured
- service worker plus Notification API for browser delivery and acknowledgment UX

There is no separate backend service. The cron job is an authenticated HTTP route in the same application.

## Development reflection

### What implementation decisions changed during development

- The session root changed from a setup-first mental model to a dashboard-first model. ` /s/[sessionId] ` now always redirects to the dashboard, and the dashboard shows placeholders until location is saved.
- Navigation was simplified and clarified. `Home` is always present, the wordmark always goes to the dashboard, and `Location & Reminders` became the shared label for both setup and settings.
- The product scope narrowed from the earlier multi-channel plan to the actually maintained system: email plus browser notifications. The code still contains some generic channel abstractions, but the active setup flow only supports email and browser.
- Email provider strategy changed from a mock-first abstraction with future-provider intent to an actual Resend-backed implementation with mock fallback.
- Debug behavior became more intentionally separate from cron behavior. In particular, debug browser sends now force real Web Push when possible so delivery can be tested without switching the whole reminder pipeline into real mode.
- The timezone UX became narrower and more opinionated. Instead of presenting a very broad list by default, the UI moved to an Americas-focused curated list plus manual IANA entry.
- Session-link generation had to become more deployment-aware. The app now prefers `NEXT_PUBLIC_APP_URL`, falls back to `VERCEL_URL` on Vercel, and only uses `localhost` as the final local fallback.
- The calendar concept was removed from the product-facing story and from current UX expectations. The paper should reflect the product that remained after this scope reduction, not the broader original plan.

### What friction points appeared in setup or reminders

- Browser notifications require both a saved session setting and a successful device subscription. A user can enable browser notifications in settings but still have no active subscription on the current device, so the UI needed explicit hints and a separate subscribe step.
- Web Push testing is awkward if developers must wait for a real prayer time. This led to two mitigations: quick debug sends with "due in ~15s" copy, and the QA reminder clock that shifts cron evaluation time.
- Real browser delivery is environment-sensitive. HTTPS, browser permission, service worker readiness, and per-device subscription state all create friction compared with a purely server-side channel like email.
- Share links caused friction when the public base URL was not configured in production. If `NEXT_PUBLIC_APP_URL` was missing, links could incorrectly resolve to `localhost`, which required a safer fallback strategy.
- Recovery is straightforward for email but not equally strong for other channels in the current build. The shipped product is effectively email-centric for recovery because phone numbers are not part of the active setup flow.
- The HELP / STOP / acknowledgment logic exists in the app but production-grade inbound email handling turned out to depend on provider/domain setup constraints. As a result, the logic is real and testable in debug, but not fully live as a production reply pipeline.

### What tradeoffs emerged around persistence, STOP, session links, Web Push, or calendar complexity

- **Persistence:** Keeping persistence on by default improves the chance that users see a reminder, but it risks nuisance if left unconstrained. The built system therefore combines user-selectable cadence, a resend cap, follow-up limits, and acknowledgment-based stopping.
- **STOP and HELP:** The application logic for STOP and HELP is simple and coherent, but full production inbound support is much harder than the logic itself because it depends on provider-level receiving and webhook setup. This created a split between implemented logic and fully deployed inbound infrastructure.
- **Session links:** Session URLs remove the need for accounts and make cross-device access simple, which is valuable for a lightweight religious utility. The tradeoff is that the link itself becomes the credential, so link generation, recovery, and careful handling of public URLs become central product concerns.
- **Web Push:** Web Push enables reminders without requiring a login or native app, but it is per-device rather than purely session-level. That creates additional complexity around permission prompts, subscription storage, expired endpoints, browser support differences, and acknowledgment semantics.
- **Calendar complexity:** Calendar integration looked attractive in the original plan because it could offload reminder timing to a platform the user already uses. In practice, it added substantial product and technical complexity relative to its value: OAuth flows, token storage, sync behavior, provider differences, and unclear acknowledgment semantics. The current build is cleaner and easier to explain because it stays focused on direct reminders through email and browser notifications.
