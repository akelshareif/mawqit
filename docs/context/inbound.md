# Inbound and channel logic (Phase 0.4)

How Mawqit handles inbound messages (STOP, HELP, generic acks) and how channel-state toggles flow between user UI, STOP replies, and the cron passes. Source of truth: [`src/lib/inbound/handle-inbound.ts`](../../src/lib/inbound/handle-inbound.ts) and [`src/lib/session-channel-status.ts`](../../src/lib/session-channel-status.ts). Update this doc whenever those files change.

## Status: not yet wired to a real webhook

There is **no real inbound webhook in production today.** [`handleInbound`](../../src/lib/inbound/handle-inbound.ts) is invoked from exactly one place:

| Caller | File | Notes |
|---|---|---|
| Debug simulator | [`POST /api/debug/simulate-inbound`](../../src/app/api/debug/simulate-inbound/route.ts) | Gated by `ENABLE_DEBUG_TOOLS=true`. Returns 404 in production. Rate-limited 30/min. |

The directory [`src/app/api/webhooks/resend/`](../../src/app/api/webhooks/resend/) exists but is empty — see the open question in [`progress.md`](../progress.md). Phase 1.2 lands the real Resend inbound at `/api/inbound/email` per [`PLAN.md` §1.2](../PLAN.md), not at the existing empty directory.

So today, the only way an inbound STOP, HELP, or ack message can reach the database is if a developer with debug tools enabled hits the simulator route. Real users replying to a Mawqit reminder get nothing back.

## `handleInbound` contract

```ts
handleInbound(
  prisma: PrismaClient,
  channel: "email",
  fromRaw: string,
  bodyRaw: string,
): Promise<{ outcome: string }>
```

The `channel` literal is restricted to `"email"` (`type InboundChannel = "email"`) — browser does not have an inbound notion at this layer. (Browser acks go through a separate API route, see "Browser ack vs inbound ack" below.)

### Outcomes

`outcome` is a stable string that callers and tests inspect. Today's possible values:

| Outcome | Meaning | Side effects |
|---|---|---|
| `invalid_address` | `normalizeEmail` rejected the `from` value | none (currently unreachable: `normalizeEmail` lowercases/trims and does not throw) |
| `no_session` | No session found whose primary email recipient matches `from` | warn-log only; the inbound is silently dropped (no `message_log` row written) |
| `stop` | Body trims+uppercases to `STOP` | `channel_status` upserted to `disabled=true`, outbound "stopped" reply sent, `message_log` row for the inbound + the outbound |
| `help` | Body trims+uppercases to `HELP` | outbound HELP reply sent (session URL + Learn-to-Pray link + STOP/HELP help text) |
| `empty` | Body is empty after `.trim()` | inbound logged but no reply, no state change |
| `no_timezone` | Generic-ack path reached but the session has no `timezone` set | inbound logged but no ack possible |
| `no_active_cycle` | Generic-ack path; session has timezone but no open `reminder_cycles` row found for today on this channel | inbound logged but no ack made |
| `ack` | Generic-ack path matched an open cycle | cycle's `ackReceived=true`, outbound "got it" reply sent |

### Address normalization and session lookup

`normalizeEmail(fromRaw)` lowercases and trims the inbound `from` value.

Session lookup is a relational `findFirst` for the session whose primary email recipient (`notification_recipients`, `type='email'`, `is_primary=true`) has `value` equal to the normalized `from`. Both sides go through `normalizeEmail` — stored values are normalized on save — so the lookup matches reliably. See flag #2 in "Things to revisit."

### Inbound logging

When a session matches, the inbound is recorded once in `message_log`:
- `direction='inbound'`
- `type='inbound_message'` (constant `INBOUND_LOG`, not part of `MESSAGE_TYPE`)
- `to` = the matched address (truncated to 320 chars)
- `body` = the inbound text (truncated to 8000 chars)
- `status='sent'`

A no-session inbound is **not** logged anywhere in the database (only an info-level log line). This is deliberate per the privacy posture, but it also means there's no audit trail for spoofed inbound traffic — flagged below.

## STOP

```
Reply: STOP   (case-insensitive after .trim().toUpperCase())
```

1. Upsert `channel_status` for `(sessionId, channel)` with `disabled=true, disabledAt=now()`. The single row is the source of truth — there's no append-only "STOP history."
2. Send an outbound confirmation: `"Notifications for email have been stopped."`
   - Email confirmations go through `createEmailProvider` — real Resend in production if `RESEND_API_KEY` + `RESEND_FROM` are set, otherwise mock.
3. Return `outcome: "stop"`.

The `channel_status` row gates **all** future cron passes for that channel on that session — initial sends, persistence resends, follow-ups, expiry reminders. See "Cron passes' channel-status reads" below.

## HELP

```
Reply: HELP
```

1. No state change to `channel_status` or `reminder_cycles`.
2. Send an outbound reply containing:
   - The session URL: `${NEXT_PUBLIC_APP_URL}/s/${sessionId}` via [`sessionUrl`](../../src/lib/public-url.ts)
   - The Learn-to-Pray link from `LEARN_TO_PRAY_URL` (default `https://example.com/learn-salah`)
   - One-line instructions: `"Reply STOP to stop notifications, HELP for this message, or any other reply to acknowledge the current prayer reminder."`
3. Return `outcome: "help"`.

This response leaks the session URL to whoever sent HELP — but the lookup already verified that the sender's address is the session's recipient, so this is fine.

## Generic-ack (anything else)

Any non-STOP, non-HELP, non-empty body is treated as an acknowledgment of the current prayer reminder.

1. Compute today's calendar date in the session's timezone via `formatDateInTimeZone(now, tz)` → parse to UTC midnight for `prayerDate`.
2. Call [`findLatestOpenCycleForAck`](../../src/lib/reminder-cycle.ts) — looks at all `reminder_cycles` rows for `(session, channel, prayerDate, ackReceived=false)`, sorted by `lastSentAt desc`, returns the first one that **isn't stale** (where "stale" means the next prayer's instant has passed; after Isha that's tomorrow's Fajr).
3. If no live cycle → `outcome: "no_active_cycle"`. If no timezone → `outcome: "no_timezone"`.
4. Otherwise, set `ackReceived=true` on the matched cycle. The persistence pass will stop touching it on its next run.
5. Send an outbound confirmation: `"Got it. Reminders for this prayer have stopped."`
6. Return `outcome: "ack"`.

The `findLatestOpenCycleForAck` "newest open, non-stale" semantics matters: a session might have several open cycles for the same channel/day if persistence sent both the initial and a resend. The ack always lands on the most recent one that's still live.

## Browser ack vs inbound ack

These are two separate code paths:

| | Browser ack | Inbound ack |
|---|---|---|
| Trigger | Service worker fetches `POST /api/sessions/[id]/reminders/ack` on notification interaction | User replies to an email reminder |
| Channel(s) | `browser` only (route hard-rejects others) | `email` |
| Selector | Exact match on `(session, channel='browser', prayerName, prayerDate, deviceKey)` | `findLatestOpenCycleForAck` — newest non-stale cycle for the channel |
| Auth | Possession of session URL (browser already has it) + format check | Match between inbound `from` and the session's primary email recipient |
| Outbound reply | None | "Got it" reply via the matching channel |

Both update `reminder_cycles.ackReceived=true`. Both are idempotent — replaying the same ack returns success but with `updated: 0` (browser route) or `outcome: "no_active_cycle"` (inbound, since the cycle is now closed).

## Channel-status model

`channel_status` (composite PK `(session_id, channel)`) is a per-session-per-channel row. The application treats it as a unified "current disable state" for that channel — there is **no separate STOP-history table**. The row's existence and its `disabled` flag together encode three states:

| Row state | Meaning |
|---|---|
| No row exists | Channel is enabled in UI; never been disabled |
| Row with `disabled=false` | Channel is enabled in UI; `disabledAt` is null |
| Row with `disabled=true` | Channel is disabled (UI off in some past flow, or STOP came in); `disabledAt` is set |

The cron passes only check `disabled=true` to skip a channel.

### How the row is written

There are exactly two writers:

1. **[`syncChannelStatuses`](../../src/lib/session-channel-status.ts) — called on every session save** (`PATCH /api/sessions/[id]`). For each of `email`, `browser`:
   - If `enabled=true` in the form → `upsert` to `(disabled=false, disabledAt=null)`. **This clears any prior STOP record.**
   - If `enabled=false` in the form → `deleteMany` for that `(session, channel)`. The row goes away entirely; any prior STOP timestamp is lost.

2. **[`handleInbound`](../../src/lib/inbound/handle-inbound.ts) on STOP** — `upsert` to `(disabled=true, disabledAt=now())`.

The dual-write model has one important semantics: **a user re-enabling a channel through the UI implicitly un-STOPs it.** If a session received STOP via email, and later the user opens settings and saves with email still ticked, the next save calls `syncChannelStatuses({emailEnabled: true, ...})` which clears `disabled` back to `false`. Reminders resume.

That is probably the right user-intent ("I told you to email me again, so email me again"), but it's worth knowing because:
- The original STOP timestamp (`disabledAt`) is overwritten with `null`. If we ever wanted "show me when this user STOP'd" for support purposes, we've lost it.
- The audit trail lives in `message_log` (the `inbound_message` row) — which is why nuking `channel_status` doesn't actually erase the history, it just changes the active state.

### How the row is read

| Reader | What it does |
|---|---|
| [`runEmailReminderPass`](../../src/lib/reminders/run-email-reminders.ts) | `WHERE NOT channelStatuses.some(channel='email', disabled=true)` plus `emailEnabled=true` — both filters required |
| [`runBrowserReminderPass`](../../src/lib/reminders/run-browser-reminders.ts) | Same shape, channel='browser', plus `browserNotificationsEnabled=true` |
| [`runPersistencePass`](../../src/lib/reminders/run-persistence-pass.ts) | Per-cycle: `findUnique` on `(session, channel)`, skip if `disabled=true` |
| [`runExpiryPass`](../../src/lib/reminders/run-expiry-pass.ts) | Per-session: looks up email + browser status before sending the warning/expiry-day messages, skips disabled channels |

Initial passes also gate on the corresponding session boolean (`emailEnabled`, `browserNotificationsEnabled`). Persistence and expiry **don't** re-check the session boolean — they trust that any cycle on the table or any expiry message worth sending was created when the channel was enabled, and that disabled now overrides.

### Why both the session boolean and `channel_status` exist

They model different concepts:
- `session.emailEnabled` (and friends) = "did the user opt this channel in during setup?"
- `channel_status.disabled` = "is this channel currently muted?"

A user who never enabled email has `emailEnabled=false` and no `channel_status` row. A user who opted in then sent STOP has `emailEnabled=true` and `channel_status(disabled=true)`. Phase 1.4 multi-recipient may rework this — a STOP from one of three email addresses shouldn't disable the channel for all three. Flagged below.

## Outbound replies

The STOP-confirmation, HELP-help, and ack-confirmation are sent through the same providers the cron uses:

- Email reply → [`createEmailProvider`](../../src/lib/providers/email.ts). Real Resend in production if env is set; mock fallback otherwise (silent — see [`pipeline.md`](pipeline.md) flag #1).

Each outbound reply writes its own `message_log` row via the provider — direction `outbound`, type `stop_reply` / `help_reply` / `ack_reply` (the `OUTBOUND` constants in `handle-inbound.ts`, distinct from the `MESSAGE_TYPE` constants used by the cron).

## Things to revisit

1. **No real inbound webhook is wired.** Phase 1.2 will land `/api/inbound/email` connected to Resend. The signature-verification and idempotency-key handling for Resend webhook events doesn't exist anywhere in the repo today — both will need to be written from scratch.

2. ~~**Inbound `from` is normalized but stored values may not be.**~~ **Correction (verified during 0.5):** stored emails *are* normalized. [`parseSetupPayload`](../../src/lib/setup-payload.ts) calls `normalizeEmail` on every save, so both sides of the lookup go through the same lowercase+trim. No mismatch risk. Leaving the strikethrough as a record of the verification.

3. **Single-row model for STOP loses history.** When a user re-enables a channel via the UI, the STOP timestamp is overwritten. The inbound itself remains in `message_log` so nothing is permanently gone, but support tooling that asks "when did this user STOP?" needs to query `message_log` for `type='inbound_message'` and `body ILIKE 'stop'`, not `channel_status.disabledAt`. Documenting so Phase 1.5 (admin page) doesn't trust `disabledAt` as an authoritative timestamp.

4. **No-session inbound is dropped silently.** When `from` doesn't match any session, we log a single info line and return. There's no `message_log` row, no rate-limiting per-sender, and no audit trail. Mostly fine for privacy, but it means a flood of inbound from a bogus address would consume webhook capacity (Resend tier) without surfacing on the admin page. Phase 1.7 (rate limiting and abuse hardening) should consider how to surface this volume.

5. **Phase 1.4 multi-recipient breaks the current STOP semantics.** Today, STOP from the (single) email recipient disables email for the whole session. With multi-recipient, STOP from one of three addresses should presumably only disable that one. The `channel_status` table's PK is `(session_id, channel)` — there's no `recipient_id`. The Phase 1.4 schema migration will need to either move STOP-state onto `notification_recipients`, or keep `channel_status` plus add a per-recipient override layer. Decide before writing the migration.

6. **`syncChannelStatuses` and `handleInbound` race.** `syncChannelStatuses` runs in a session-PATCH transaction (well — Prisma calls aren't wrapped in `$transaction`, but they're sequential). If a STOP arrives mid-save, the resulting state depends on ordering: STOP first → save with `enabled=true` then clears the STOP. This is consistent with the user-intent model in "How the row is written," but is a race nonetheless. In practice the window is microseconds. Documenting only.

7. **Handler returns are stringly-typed.** `outcome: string` rather than a discriminated union. Tests grep on the literals. Keep this; turning it into an enum would force every test to import the type. Not a 0.7 cleanup target.

8. **`OUTBOUND` constants are local to `handle-inbound.ts`.** They duplicate the pattern in `MESSAGE_TYPE` ([`message-types.ts`](../../src/lib/message-types.ts)). When inbound becomes real (Phase 1.2), consider moving them into `MESSAGE_TYPE` so `message_log.type` has a single canonical taxonomy. Not Phase 0 work — flag for Phase 1.2.

9. **Unused `body` field in inbound `message_log`.** The inbound message body is stored in `message_log.body` (truncated to 8000 chars). PII consideration: an inbound HELP from a real email may contain auto-quoted prior reminder text, which contains the recipient address again. The truncation is fine, the storage is fine, but the admin page (Phase 1.5) needs to keep this row out of cleartext display. Already flagged in [`schema.md`](schema.md) #4 — restating here in the inbound context.
