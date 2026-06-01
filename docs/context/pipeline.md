# Reminder pipeline trace (Phase 0.3)

End-to-end trace of what happens between an external `GET /api/cron/reminders` request and a delivered email or push notification. Source of truth is the code under [`src/app/api/cron/reminders/route.ts`](../../src/app/api/cron/reminders/route.ts) and [`src/lib/reminders/`](../../src/lib/reminders/). Update this doc whenever any of those files change.

## Entry point

[`GET /api/cron/reminders`](../../src/app/api/cron/reminders/route.ts) is the only entry point. There is no built-in scheduler — an external service (cron-job.org, GitHub Actions, your laptop, anything) drives it on the `CRON_INTERVAL_MINUTES` cadence (default 5).

1. **Auth.** [`verifyCronSecret`](../../src/lib/cron-auth.ts) does a constant-time compare against `Bearer ${CRON_SECRET}`. Empty/missing secret → 401. Empty `CRON_SECRET` env var → 401 (the route refuses to run). All real callers must send `Authorization: Bearer $CRON_SECRET`.

2. **CronRun row.** A row is inserted into `cron_runs` with `status='running'`, then updated to `success` or `error` when the run finishes. This is the observability handle — Phase 1.5 will surface the most recent run on the admin page.

3. **Dual clocks.** Two timestamps are computed:
   - `realNow` = `new Date()` — the wall clock. Used for session expiry checks (`expiresAt > realNow`).
   - `reminderNow` = `realNow` shifted by `QA_REMINDER_CLOCK_OFFSET_MINUTES` when the QA clock is enabled. Used for **prayer-time comparisons and persistence cadence**. The QA clock turns on if `ENABLE_QA_REMINDER_CLOCK=true` *or* `ENABLE_DEBUG_TOOLS=true` (the second is a local-dev convenience). See [`getReminderNow`](../../src/lib/env.ts) and [`CronReminderClocks`](../../src/lib/reminders/cron-clocks.ts).
   - The split exists so QA can fast-forward "what would happen at Maghrib?" without also faking a session into expiry. Don't use `reminderNow` to gate session lifetime.

4. **Pass execution order.** Strictly sequential, awaited:
   1. `runExpiryPass(prisma, realNow)` — flips overdue sessions to `expired`, sends "expires soon" warnings.
   2. `runEmailReminderPass(prisma, clocks)` — initial email for any prayer whose time has passed today.
   3. `runBrowserReminderPass(prisma, clocks)` — initial Web Push, per device.
   4. `runPersistencePass(prisma, clocks)` — resends + follow-ups against open `ReminderCycle` rows.
5. **Counters and finalize.** All four passes return `{ sessionsProcessed, messagesSent }`; the route sums them and writes them onto the `CronRun` row plus the response body.

If anything throws, the catch updates the cron run to `status='error'` and returns 500. The send ledger ensures the next run is safe to re-execute against the same prayer windows.

## Pass 1 — Expiry ([`run-expiry-pass.ts`](../../src/lib/reminders/run-expiry-pass.ts))

Two-step:

1. **Bulk expire.** `prisma.session.updateMany` flips every `active` session whose `expiresAt <= realNow` to `expired`. Logged with a count.

2. **Per-session expiry-soon scan.** For every still-active session with a non-null `expiresAt` and `timezone`:
   - Compute the calendar day in the session's timezone for both "now" and "expiresAt." If they're equal → it's expiry day. If `msUntilExpiry <= warningDays * 24h` and it's *not* expiry day → it's the warning window (`warningDays` defaults to 3, env override `SESSION_EXPIRY_WARNING_DAYS`).
   - Look up the `channel_status` rows for `email` and `browser` to honor any STOP requests.
   - If expiry day and `expiryDayReminderSentAt IS NULL` → send "expires today" via email and to every push subscription. On any successful send, write `expiryDayReminderSentAt = now()`.
   - Else if in the warning window and `expiryWarningSentAt IS NULL` → same shape, with the "expires soon" copy.

Idempotency on these comes from the two `expiry*SentAt` columns on `Session`. They're not partial unique indexes — just a single nullable timestamp checked before sending. That works because there's only one warning and one expiry-day reminder per session.

`messagesSent` here is the count of **individual outbound messages**, including one per push subscription on the session.

## Pass 2 — Initial email reminders ([`run-email-reminders.ts`](../../src/lib/reminders/run-email-reminders.ts))

Selects sessions with: `emailEnabled=true`, `emailAddress` set, location and timezone set, `sessionStatus='active'`, `expiresAt > realNow`, and **not** disabled in `channel_status`.

For each session:

1. Compute the day-of-prayer in the session's timezone using [`resolvePrayerDate`](../../src/lib/prayer-times.ts) (UTC noon for the local Y/M/D — works because Vercel runs in UTC).
2. Build a `PrayerTimes` from adhan with the session's `prayerMethod` (defaults to `MuslimWorldLeague`; only 5 string values are mapped — see [`getCalculationParameters`](../../src/lib/prayer-times.ts)).
3. Iterate `["fajr", "dhuhr", "asr", "maghrib", "isha"]` (`SALAH_KEYS` — sunrise excluded).
4. For each prayer where `reminderNow >= prayerInstant`:
   1. **Claim a ledger row** via [`tryCreateSentReminder`](../../src/lib/reminders/sent-reminder.ts) with `channel='email'`, `messageType='prayer_reminder'`, `pushSubscriptionId=null`. If the partial unique index rejects it (P2002) → another cron already sent this; skip.
   2. **Send** via the email provider.
   3. **On send failure**, delete the just-claimed `sent_reminders` row (so the next cron run can retry) and write a `failed` row to `message_log`.
   4. **On success**, increment counter and `upsertReminderCycleOnSend` — creates or touches the `reminder_cycles` row that the persistence pass will later watch.

The provider itself writes the `message_log` row on success (mock and Resend paths both do this). The cron writes a separate `failed` `message_log` row only when the send call returns failure — so on the success path there's exactly one log row per attempt.

## Pass 3 — Initial browser push ([`run-browser-reminders.ts`](../../src/lib/reminders/run-browser-reminders.ts))

Same structure as email, but **iterates over `push_subscriptions`** (not sessions), so a session with three browser devices gets three independent walks. Selection joins through `session` and applies the same active/expires/channel-status filters as the email pass, plus `browserNotificationsEnabled=true`.

Per-prayer logic mirrors email with two divergences:

- The `sent_reminders` claim sets `pushSubscriptionId=sub.id`. This routes through the **second** partial unique index (the one for browser sends), keying idempotency on (session, prayer, date, message_type, subscription).
- After `push.sendPrayerReminder`, the result has a third state: `gone=true` for HTTP **410 Gone** or **404 Not Found** from the push service. Handling:
  - Delete the `sent_reminders` row that was just claimed.
  - Delete the `push_subscriptions` row.
  - `break` out of the prayer loop for that subscription — there's no point trying further prayers against a dead endpoint.
- `sessionsProcessed` is the size of the distinct-session set (not the subscription count) so cron-run metrics reflect users, not devices.

## Pass 4 — Persistence ([`run-persistence-pass.ts`](../../src/lib/reminders/run-persistence-pass.ts))

This is the resend + follow-up engine. Its input is the `reminder_cycles` table — the rows that the email and browser initial passes seeded.

Selection: every cycle where `ackReceived=false`, joined to a session that's still active and not expired.

Per cycle, run a sequence of skip checks:

1. Skip if session has lost its location/timezone.
2. Skip if [`isReminderCycleStale`](../../src/lib/reminder-cycle.ts): the next prayer's instant is already past (after Isha, the comparison rolls to tomorrow's Fajr). This is what lets a cycle fall off naturally without an explicit "close" step.
3. Skip if `channel_status` has the cycle's channel disabled (STOP came in).
4. Skip if the cycle's `prayerDate` differs from today's calendar day in the session's timezone — guards against cycles surviving into a new day, even though step 2 should normally have already culled them.
5. Skip if `cycle.lastSentAt IS NULL` (cycle never had a successful send).

Then compute two flags from session settings:

- `followupDue` = `followupEnabled && !followupSent && reminderNow - firstSentAt >= followupDelayMinutes`
- `resendDue` = `persistentReminders && resendCount < 6 && reminderNow - lastSentAt >= persistenceCadenceMinutes`

If `followupDue`, send a follow-up (`messageType='followup'`); the `continue` afterward means a follow-up wins over a resend in the same tick. Else if `resendDue`, send a resend (`messageType='persistence_resend'`).

Both branches:

- Claim a new `sent_reminders` row with the corresponding `messageType`. The follow-up has `messageType='followup'`, the resend has `messageType='persistence_resend'`. Because `messageType` is part of the partial unique index, these don't collide with the initial `prayer_reminder` row from the same prayer.
- Dispatch through the per-channel branch: `email` → `EmailProvider.send`, `browser` → look up the `push_subscriptions` row by `cycle.deviceKey` and call `push.sendPrayerReminder`.
- On `push.gone`, delete the `sent_reminders` claim and the dead subscription. On any other failure, just delete the claim.
- On success, update the cycle: `markCycleFollowupSent` (sets `followupSent=true`, refreshes `lastSentAt`) for follow-ups, `touchCycleAfterPersistenceSend` (increments `resendCount`, refreshes `lastSentAt`) for resends.

`MAX_RESENDS_PER_CYCLE = 6` is a constant in [`reminder-cycle.ts`](../../src/lib/reminder-cycle.ts) — at 15-minute default cadence that's a 90-minute window before the cycle stops resending even if the user never acks and the next prayer hasn't arrived.

## How idempotency is enforced (the send ledger)

The whole pipeline rests on three primitives:

1. **Two partial unique indexes on `sent_reminders`** (see [`schema.md`](schema.md)) — one for email/calendar, one for browser. They make `INSERT INTO sent_reminders` either succeed (this send is new) or fail with `P2002` (someone else got there first).
2. **Claim-then-send.** Every send path follows the pattern:
   ```
   claim = tryCreateSentReminder(...)        // INSERT
   if (claim === null) skip                  // already done
   result = await provider.send(...)         // outbound
   if (!result.success) { delete claim; ... } // rollback
   ```
   That ordering is what makes the pipeline safe against double-execution: if cron is invoked twice in quick succession, both invocations race the INSERT, only one wins, and the other no-ops.
3. **Rollback on failure.** A failed send must delete its `sent_reminders` row, otherwise the next cron run would skip the retry. Every send path in the pipeline does this. **Do not** add a new send path that omits the rollback.

Pre-Phase-1.4 caveat: a row deleted-on-failure is forever indistinguishable from "never tried." The `message_log` row carries the failure record. If a session's `message_log` shows a failed send for a prayer and a successful send for that same prayer at a later timestamp, what happened was: failure → claim deleted → next cron run claimed and succeeded. That's the expected pattern.

## How follow-ups and persistence are tracked (the cycle table)

`reminder_cycles` is the per-(session, channel, prayer, day, device) rollup that the persistence pass walks. The initial-send passes upsert it via [`upsertReminderCycleOnSend`](../../src/lib/reminder-cycle.ts) — first insert creates with `firstSentAt=lastSentAt=now()`, subsequent touches update `lastSentAt` only.

Why a separate table when the ledger already has every send? Because the persistence pass needs:
- A fast lookup of "open cycles to consider" (`ackReceived=false` predicate, indexed via the unique constraint).
- Per-cycle aggregates (`resendCount`, `followupSent`) that aren't easily computed from the ledger.
- A single update target when an ack comes in.

A cycle naturally retires three ways: ack received, becomes stale (next prayer passed), or session expires. There's no explicit "close" — the persistence pass just stops touching it.

## Acknowledgment ([`/api/sessions/[sessionId]/reminders/ack`](../../src/app/api/sessions/[sessionId]/reminders/ack/route.ts))

`POST` from the service worker on a browser-push notification interaction. Updates every matching `reminder_cycles` row to `ackReceived=true`. **Only `channel=browser` is accepted today** — the route hard-rejects anything else with 400. Email reminders have no ack mechanism, so their cycles only retire by going stale.

The route is rate-limited (120/min/IP per session) and validates session-ID format. It does not require any other auth — possession of the session URL is the credential, and the worst a forged ack does is silence one cycle's resends.

## Mock modes — full inventory of env switches

The pipeline has two real providers (email via Resend, browser push via the `web-push` library). Every provider write goes through `message_log` regardless of mock/real, so the audit trail is consistent.

| Env var | Read by | Default | Effect |
|---|---|---|---|
| `WEB_PUSH_MODE` | [`getWebPushMode`](../../src/lib/env.ts) → [`createWebPushProvider`](../../src/lib/providers/web-push.ts:183) | `mock` | `mock` writes `message_log` only and never calls FCM/APNs. `real` calls `webpush.sendNotification`. |
| `EMAIL_FORCE_MOCK` | [`createEmailProvider`](../../src/lib/providers/email.ts:155) | unset | When `true`, returns the mock provider even if Resend env is set. Tests/local. |
| `RESEND_API_KEY` + `RESEND_FROM` | [`createEmailProvider`](../../src/lib/providers/email.ts:158-161) | unset | Both must be set for the real Resend path. If either is missing, the mock provider is returned (silently). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | [`ensureVapidConfigured`](../../src/lib/providers/web-push.ts:36) | unset | Required for `WEB_PUSH_MODE=real`. Missing keys → throw. Real Web Push fails fast. |
| `VAPID_SUBJECT` | [`getVapidSubject`](../../src/lib/env.ts:36) | `mailto:support@mawqit.local` | `mailto:` or `https:` URI sent as the VAPID `sub` claim. |
| `QA_REMINDER_CLOCK_OFFSET_MINUTES` | [`getQaReminderClockOffsetMinutes`](../../src/lib/env.ts:68) | `0` | Minutes added to wall time for `reminderNow` (only when QA clock is on). |
| `ENABLE_QA_REMINDER_CLOCK` | [`isQaReminderClockEnabled`](../../src/lib/env.ts:80) | unset | Explicit on-switch. Also implicitly on when `ENABLE_DEBUG_TOOLS=true`. |
| `ENABLE_DEBUG_TOOLS` | [`getEnableDebugTools`](../../src/lib/env.ts:53) | `false` | Gates `/s/.../debug` UI, debug API routes, and (as a side-effect) the QA clock. In production, also requires `ALLOW_DEBUG_TOOLS_IN_PRODUCTION=true`. |
| `CRON_SECRET` | [`verifyCronSecret`](../../src/lib/cron-auth.ts) | unset | If unset or empty, the cron route refuses every request (401). |
| `CRON_INTERVAL_MINUTES` | [`getCronIntervalMinutes`](../../src/lib/env.ts:19) | `5` | Documented for external schedulers. The route doesn't enforce it. |
| `SESSION_EXPIRY_WARNING_DAYS` | [`getSessionExpiryWarningDays`](../../src/lib/env.ts:10) | `3` | Days before `expiresAt` to send the "expires soon" notice. |

The mock email provider doesn't have a separate "force on" flag — it's returned implicitly when the real-provider env is missing or `EMAIL_FORCE_MOCK=true`. The Web Push mock is the inverse: it's the default (`WEB_PUSH_MODE=mock`), and you opt **in** to real with `WEB_PUSH_MODE=real`.

## Things to revisit

1. **Email provider mock-fallback is silent.** When `RESEND_API_KEY` or `RESEND_FROM` is missing in production, [`createEmailProvider`](../../src/lib/providers/email.ts:163) returns the mock provider with no warning logged. A misconfigured production deploy would silently log every "send" to `message_log` and never deliver. Phase 1.5 (observability) should add a startup log + admin-page surface for "current email mode = mock|real" so this is visible. Flagging now.

2. **`SESSION_VALIDITY_DAYS` is read** ([`getSessionValidityDays`](../../src/lib/env.ts:1)) but the cron pipeline doesn't consume it; only the session create/update path does. This is correct (the cron only checks `expiresAt`, which was computed at save time using `SESSION_VALIDITY_DAYS`). Documenting so a future reader doesn't grep for it in cron and conclude something is missing.

3. **`MESSAGE_TYPE.calendarEventEnsured`** is defined in [`message-types.ts`](../../src/lib/message-types.ts) but never used. Reserved for the Phase 2.5 calendar feed. Don't delete.

4. **Persistence pass loops in memory.** It loads every open `reminder_cycles` row in one query and iterates. At 5,000 active sessions × 5 prayers, that's 25k rows on a busy day. Fine for now. Phase 1.5/Phase 3 may want to chunk if the table grows. Not Phase 0 work.

5. **Browser ack route only matches by `(session, channel='browser', prayerName, prayerDate, deviceKey)` with `ackReceived=false`.** A delayed/duplicate ack after the cycle is already acked returns `updated: 0` with no error — that's intentional and idempotent. Documenting because the response shape ("ok: true, updated: 0") could read as a failure but isn't.

6. **Resend's `result.error` shape** is hand-parsed in [`createResendEmailProvider`](../../src/lib/providers/email.ts:86-92): "if it's an object with `message`, use that, else `JSON.stringify`." This is fine but fragile against future Resend SDK changes. Phase 1.1 (domain + Resend setup) should re-check this when the SDK gets exercised against real sends.

7. ~~**`expiry*SentAt` markers don't reset on session renewal.**~~ **Correction (verified during 0.4):** they *do* reset. [`PATCH /api/sessions/[id]`](../../src/app/api/sessions/[sessionId]/route.ts) explicitly sets both `expiryWarningSentAt` and `expiryDayReminderSentAt` to `null` on every save, alongside the renewed `expiresAt`. So the warning window will re-fire correctly the next time the session approaches expiry. No bug here — leaving the strikethrough as a record of an earlier mis-read.

8. **No structured logging of per-channel success/fail counts.** PLAN.md §1.5 asks for "structured logging on cron runs with session count and per-channel success/fail." Today we log per-message info-level lines and the run total, but not a per-channel breakdown. Phase 1.5 will need to add this.
