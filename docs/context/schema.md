# Schema audit

Snapshot of the Mawqit Postgres schema. Source of truth: [`prisma/schema.prisma`](../../prisma/schema.prisma) and the SQL files in [`prisma/migrations/`](../../prisma/migrations/). Update this doc whenever the schema changes.

> **Updated 2026-05-31 (Phase 1.4):** the single-value location/contact columns moved
> off `sessions` into `saved_locations` and `notification_recipients`, and
> `subscriptions` + `donations` were added. See the new-tables and migration sections
> below.

## Enums

| Enum | Values |
|---|---|
| `SessionStatus` | `active`, `expired` |
| `ReminderChannel` | `email`, `sms`, `calendar`, `browser` |
| `MessageDirection` | `outbound`, `inbound` |
| `MessageDeliveryStatus` | `sent`, `failed` |
| `CronRunStatus` | `running`, `success`, `error` |
| `RecipientType` | `email`, `sms` *(Phase 1.4)* |
| `SubscriptionTier` | `monthly`, `quarterly`, `semiannual`, `yearly` *(Phase 1.4)* |
| `SubscriptionStatus` | `active`, `expired` *(Phase 1.4)* |

`sms` and `calendar` already exist in `ReminderChannel` even though SMS is a Phase 3 feature and the `.ics` calendar feed is Phase 2.5. Treat as intentional groundwork; do not remove.

## Models

The whole schema is rooted at `Session`. Every other table has a `session_id` foreign key with `ON DELETE CASCADE` (so deleting a session today wipes everything). One non-session foreign key exists: `SentReminder.pushSubscriptionId → PushSubscription.id` with `ON DELETE SET NULL`.

### `Session` → table `sessions`

The shareable-link credential. The session ID itself is the auth — anyone with the URL can read and edit.

| Field | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | `text PK` | UUID, default generated |
| `createdAt` | `created_at` | `timestamp(3)` | default `now()` |
| `updatedAt` | `updated_at` | `timestamp(3)` | `@updatedAt` |
| `emailEnabled` | `email_enabled` | `boolean` | default `false` |
| `smsEnabled` | `sms_enabled` | `boolean` | default `false`; channel exists in schema, real sends Phase 3 |
| `browserNotificationsEnabled` | `browser_notifications_enabled` | `boolean` | default `false` |

> *Phase 1.4 removed `latitude`, `longitude`, `timezone`, `email_address`, and
> `phone_number` from `sessions`. Location now lives in `saved_locations` and contact
> info in `notification_recipients` (see below).*
| `persistentReminders` | `persistent_reminders` | `boolean` | default `true` — drives the persistence pass |
| `persistenceCadenceMinutes` | `persistence_cadence_minutes` | `integer` | default `15` |
| `followupEnabled` | `followup_enabled` | `boolean` | default `false` |
| `followupDelayMinutes` | `followup_delay_minutes` | `integer` | default `30` |
| `prayerMethod` | `prayer_method` | `varchar(64)` | default `'MuslimWorldLeague'` (one of adhan's calculation methods) |
| `expiresAt` | `expires_at` | `timestamptz?` | session validity window |
| `sessionStatus` | `session_status` | `SessionStatus` | default `active` |
| `expiryWarningSentAt` | `expiry_warning_sent_at` | `timestamptz?` | "your link expires in N days" idempotency marker |
| `expiryDayReminderSentAt` | `expiry_day_reminder_sent_at` | `timestamptz?` | "expires today" idempotency marker |

Relations: 1:N to `PushSubscription`, `MessageLog`, `SentReminder`, `ChannelStatus`, `ReminderCycle`. All cascade.

Indexes: PK on `id`. No other indexes — every child table indexes `session_id` instead.

### `ReminderCycle` → table `reminder_cycles`

One row per (session, channel, prayer, day, device). Tracks the lifecycle of a single reminder: first sent, last sent, ack received, follow-up sent, resend count. The persistence pass and follow-up pass read and update this row.

| Field | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | `text PK` | UUID |
| `sessionId` | `session_id` | `text` | FK → `sessions.id`, `ON DELETE CASCADE` |
| `channel` | `channel` | `ReminderChannel` | |
| `prayerName` | `prayer_name` | `varchar(32)` | e.g. "fajr", "dhuhr"… |
| `prayerDate` | `prayer_date` | `date` | calendar day in the session's local timezone (no time component) |
| `deviceKey` | `device_key` | `varchar(64)` | default `''`. Empty for email/SMS; equals `push_subscriptions.id` for browser |
| `ackReceived` | `ack_received` | `boolean` | default `false` |
| `followupSent` | `followup_sent` | `boolean` | default `false` |
| `resendCount` | `resend_count` | `integer` | default `0` |
| `firstSentAt` | `first_sent_at` | `timestamptz?` | |
| `lastSentAt` | `last_sent_at` | `timestamptz?` | |
| `createdAt` | `created_at` | `timestamp(3)` | default `now()` |
| `updatedAt` | `updated_at` | `timestamp(3)` | |

Indexes:
- PK on `id`
- Unique on `(session_id, channel, prayer_name, prayer_date, device_key)` — one cycle row per (session, channel, prayer, day, device)
- Index on `session_id`

### `PushSubscription` → table `push_subscriptions`

One row per browser device the user has subscribed.

| Field | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | `text PK` | UUID |
| `sessionId` | `session_id` | `text` | FK → `sessions.id`, `ON DELETE CASCADE` |
| `endpoint` | `endpoint` | `text` | unique — the push service URL |
| `p256dh` | `p256dh` | `text` | client public key |
| `auth` | `auth` | `text` | client auth secret |
| `createdAt` | `created_at` | `timestamp(3)` | default `now()` |
| `updatedAt` | `updated_at` | `timestamp(3)` | |

Indexes: PK on `id`, unique on `endpoint`, index on `session_id`.

### `ChannelStatus` → table `channel_status`

Per-session-per-channel disable record, set when a STOP message comes in or the user toggles a channel off in setup.

| Field | Column | Type | Notes |
|---|---|---|---|
| `sessionId` | `session_id` | `text` | composite PK part 1; FK → `sessions.id`, `ON DELETE CASCADE` |
| `channel` | `channel` | `ReminderChannel` | composite PK part 2 |
| `disabled` | `disabled` | `boolean` | default `false` |
| `disabledAt` | `disabled_at` | `timestamptz?` | |

Indexes: composite PK on `(session_id, channel)` only. No separate `session_id` index — Postgres can prefix-scan the composite PK for `WHERE session_id = ?` queries.

### `MessageLog` → table `message_log`

Audit trail of every message in or out, both successes and failures. Mock-mode email/push writes still go in here (the mock path produces a "sent" row without making a real provider call — that's how dev/test exercises the cron without paying for real sends).

| Field | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | `text PK` | UUID |
| `sessionId` | `session_id` | `text` | FK → `sessions.id`, `ON DELETE CASCADE` |
| `channel` | `channel` | `ReminderChannel` | |
| `prayerName` | `prayer_name` | `varchar(32)?` | nullable — not all messages relate to a prayer |
| `type` | `type` | `varchar(64)` | e.g. `prayer_reminder`, `recovery_link`, `expiry_warning`, `inbound_stop` |
| `direction` | `direction` | `MessageDirection` | `outbound` or `inbound` |
| `to` | `to` | `varchar(320)` | email or phone (this is PII; never log to stdout at info/debug) |
| `body` | `body` | `text?` | message body if applicable |
| `status` | `status` | `MessageDeliveryStatus` | `sent` or `failed` |
| `errorMessage` | `error_message` | `text?` | provider error string |
| `createdAt` | `created_at` | `timestamp(3)` | default `now()` |

Indexes: PK on `id`, index on `session_id`.

### `SentReminder` → table `sent_reminders` (the send ledger)

Idempotency core. Before sending a reminder, code checks whether a row already exists for `(session, prayer, date, channel, message_type[, push_subscription])`. If yes, skip. If no, send and write the row. This is what guarantees that a cron run that fires twice in the same window does not double-send.

| Field | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | `text PK` | UUID |
| `sessionId` | `session_id` | `text` | FK → `sessions.id`, `ON DELETE CASCADE` |
| `prayerName` | `prayer_name` | `varchar(32)` | |
| `prayerDate` | `prayer_date` | `date` | calendar day |
| `channel` | `channel` | `ReminderChannel` | |
| `messageType` | `message_type` | `varchar(64)` | distinguishes initial reminder vs follow-up vs resend |
| `pushSubscriptionId` | `push_subscription_id` | `text?` | FK → `push_subscriptions.id`, `ON DELETE SET NULL` (preserves ledger after device unsubscribes) |
| `createdAt` | `created_at` | `timestamp(3)` | default `now()` |

Indexes:
- PK on `id`
- Index on `session_id`
- **Two partial unique indexes for idempotency** — written directly in raw SQL inside the `slice4_cron_email` migration:
  - `sent_reminders_nonpush_channels_unique` on `(session_id, prayer_name, prayer_date, channel, message_type)` `WHERE channel IN ('email','sms','calendar') AND push_subscription_id IS NULL`
  - `sent_reminders_browser_push_unique` on `(session_id, prayer_name, prayer_date, message_type, push_subscription_id)` `WHERE channel = 'browser' AND push_subscription_id IS NOT NULL`

The split exists because browser sends are per-device (one user can have multiple subscriptions), while email/SMS/calendar are per-session.

### `CronRun` → table `cron_runs`

Observability. One row per cron invocation, written at the start (`status='running'`) and updated at the end (`success` or `error`).

| Field | Column | Type | Notes |
|---|---|---|---|
| `id` | `id` | `text PK` | UUID |
| `startedAt` | `started_at` | `timestamp(3)` | default `now()` |
| `completedAt` | `completed_at` | `timestamptz?` | |
| `status` | `status` | `CronRunStatus` | |
| `sessionsProcessed` | `sessions_processed` | `integer` | default `0` |
| `messagesSent` | `messages_sent` | `integer` | default `0` |

No FK, no `session_id` — this is global. PK on `id` is the only index.

### `SavedLocation` → table `saved_locations` *(Phase 1.4)*

A session's location(s). The `is_active = true` row drives prayer-time calculation.
One-to-many so premium can save multiple; the free tier keeps a single active row
(replaced on each save). Columns: `latitude`/`longitude` (`double precision`, required),
`timezone` (`varchar(128)`, required), `name` (`varchar(120)?`, unused in 1.4),
`is_active` (`boolean`), plus `session_id` FK (`ON DELETE CASCADE`) and timestamps.
Indexes: PK on `id`, index on `session_id`.

### `NotificationRecipient` → table `notification_recipients` *(Phase 1.4)*

A session's email/SMS targets. The `is_primary = true` row (per `type`) is the default
target. One-to-many so premium can add more; free tier keeps a single primary row per
channel. Columns: `type` (`RecipientType`), `value` (`varchar(320)`, PII), `is_primary`
(`boolean`), `verified_at` (`timestamptz?`, for the Phase 2.5 verification flow), plus
`session_id` FK (`ON DELETE CASCADE`) and timestamps. Indexes: PK on `id`, index on
`session_id`, index on `(type, value)` for inbound/recovery lookup by address.

### `Subscription` → table `subscriptions` *(Phase 1.4, used from Phase 2)*

Mawqit+ subscription. One-to-one with a live session via a unique nullable FK
(`ON DELETE SET NULL` — the payment record survives session deletion;
`stripe_customer_id` is the recovery anchor). `deleted_at` is a separate soft-delete for
refund/chargeback removal. Columns: `stripe_customer_id` (required), `stripe_subscription_id`
(`?`, nullable — one-time payments), `tier` (`SubscriptionTier`), `status`
(`SubscriptionStatus`, default `active`), `period_end` (`timestamptz`), `last_renewed_at`
(`timestamptz?`), `deleted_at` (`timestamptz?`). Indexes: PK on `id`, unique on
`session_id`, index on `stripe_customer_id`. No reader until Phase 2.

### `Donation` → table `donations` *(Phase 1.4, used from Phase 2.6)*

Donation log. **No session link** — donations come from anonymous Stripe Payment Links
(PLAN §2.6). Columns: `stripe_session_id` (`text`, unique), `amount` (`integer`, cents),
`currency` (`varchar(3)`), `created_at`. Indexes: PK on `id`, unique on
`stripe_session_id`. No reader until Phase 2.6.

## Cascade-delete summary

| Child table | Trigger | Behavior |
|---|---|---|
| `push_subscriptions` | `sessions.id` removed | CASCADE delete |
| `channel_status` | `sessions.id` removed | CASCADE delete |
| `message_log` | `sessions.id` removed | CASCADE delete |
| `sent_reminders` | `sessions.id` removed | CASCADE delete |
| `reminder_cycles` | `sessions.id` removed | CASCADE delete |
| `sent_reminders` | `push_subscriptions.id` removed | SET NULL on `push_subscription_id` |

Phase 1.4 cascade rules (implemented): `saved_locations` and
`notification_recipients` **cascade-delete** with the session (config, no record
value). `subscriptions` uses `ON DELETE SET NULL` on its session FK so the payment
record survives, plus a `deleted_at` soft-delete column. `donations` has no session
link, so session deletion doesn't touch it.

## Index summary

| Table | Indexes |
|---|---|
| `sessions` | PK on `id` |
| `reminder_cycles` | PK on `id` · unique on `(session_id, channel, prayer_name, prayer_date, device_key)` · index on `session_id` |
| `push_subscriptions` | PK on `id` · unique on `endpoint` · index on `session_id` |
| `channel_status` | composite PK on `(session_id, channel)` |
| `message_log` | PK on `id` · index on `session_id` |
| `sent_reminders` | PK on `id` · index on `session_id` · partial unique on non-push channels · partial unique on browser channel |
| `cron_runs` | PK on `id` |
| `saved_locations` | PK on `id` · index on `session_id` |
| `notification_recipients` | PK on `id` · index on `session_id` · index on `(type, value)` |
| `subscriptions` | PK on `id` · unique on `session_id` · index on `stripe_customer_id` |
| `donations` | PK on `id` · unique on `stripe_session_id` |

## Location/contact 1:N move (completed in Phase 1.4)

The single-value location and contact columns moved off `sessions` into dedicated
tables. With no production data yet, this was a **fresh-start cutover** (no backfill,
columns dropped outright) rather than the keep-then-drop rollout PLAN §1.4 sketched.

| Old `sessions` column | New home |
|---|---|
| `email_address` | `notification_recipients`, `type='email'`, `is_primary=true` |
| `phone_number` | `notification_recipients`, `type='sms'`, `is_primary=true` |
| `latitude`, `longitude`, `timezone` | `saved_locations`, `is_active=true` |
| (Stripe identity — none before) | `subscriptions` (1:1, used from Phase 2) |
| (Donation events — none before) | `donations` (no session link, used from Phase 2.6) |

Readers resolve the active location and primary recipients via
[`src/lib/session-targets.ts`](../../src/lib/session-targets.ts)
(`activeLocation`, `primaryRecipientValue`); the PATCH `/api/sessions/[id]` save path
writes them in a transaction.

`prayer_method` stays on `sessions` for now. It is single-valued today. If Phase 2
multi-location supports per-location calculation methods, it would move to
`saved_locations` — a future-Phase-2 design question, not a Phase 1 concern.

## Migrations history

Migrations are in [`prisma/migrations/`](../../prisma/migrations/). Each is a directory with a `migration.sql`. They are immutable — Prisma's contract is that applied migrations are never edited.

| Order | Directory | What it does |
|---|---|---|
| 1 | `20260329194136_init` | Creates `sessions` with only `id`, `created_at`, `updated_at` |
| 2 | `20260329195309_slice2_session_setup` | Adds the entire setup payload to `sessions` (location, channel toggles, contact info, prayer method, persistence/follow-up settings, expiry markers) and the `SessionStatus` enum |
| 3 | `20260329200228_slice3_prayer_push_stub` | Creates `push_subscriptions` (cascade FK to sessions) |
| 4 | `20260329210000_slice4_cron_email` | Creates `ReminderChannel`, `MessageDirection`, `MessageDeliveryStatus`, `CronRunStatus` enums; creates `channel_status`, `message_log`, `sent_reminders`, `cron_runs`; adds the two partial unique indexes that enforce send-ledger idempotency |
| 5 | `20260330120000_slice7_reminder_cycles` | Creates `reminder_cycles` with the composite unique constraint that defines a cycle |
| 6 | `20260406202035_slice7` | Renames a single index on `reminder_cycles` (cosmetic — Prisma rename to fit Postgres' 63-char identifier limit). No schema-shape change. |
| 7 | `20260531120000_phase_1_4_schema` | **Phase 1.4.** Drops `latitude`, `longitude`, `timezone`, `email_address`, `phone_number` from `sessions`. Adds enums `RecipientType`, `SubscriptionTier`, `SubscriptionStatus`. Creates `saved_locations`, `notification_recipients` (both cascade), `subscriptions` (FK `SET NULL` + `deleted_at`), `donations` (no session link). Authored offline via `prisma migrate diff`; apply with `prisma migrate dev`. |

`migration_lock.toml` pins the provider to `postgresql`.

## Things to revisit

1. **Mixed timestamp types.** `created_at` / `updated_at` columns use `timestamp(3)` (no timezone). `expires_at`, `disabled_at`, `first_sent_at`, `last_sent_at`, `expiry_warning_sent_at`, `expiry_day_reminder_sent_at`, and `cron_runs.completed_at` use `timestamptz`. The split happens to be "auto-managed Prisma columns" vs "manually-set application columns," which is consistent in pattern, but the inconsistency is worth knowing for any time-window query that compares the two. Not a bug; documenting so 0.7 doesn't try to "normalize" anything.

2. **Comment dangle in `slice4_cron_email/migration.sql`.** The partial-index block carries a comment `-- Partial unique indexes (mawqit_plan.md — idempotency)`. The referenced file does not exist in the repo. Migrations are immutable, so this stays as-is — flagging only so a future reader doesn't go hunting for `mawqit_plan.md`.

3. **`slice7` migration is a pure index rename.** No model change. If it ever becomes a problem (e.g., we squash early migrations for a fresh start), this one is safe to fold in.

4. **`message_log.body` stores PII.** The recipient's email goes in `to`; the message body may include the recipient's email or phone. Whatever Phase 1.6 (Privacy Policy) and Phase 1.5 (admin page) build on top of `message_log` must respect this — the admin page must not display `to` or `body` in cleartext. Flagging for those phases.

5. **`SentReminder.pushSubscriptionId → SET NULL`** is the right choice (preserves the ledger after a device unsubscribes), but it does mean a future re-subscribe of the same device — which gets a new `push_subscriptions.id` — will see no ledger row and could re-send the same prayer. Acceptable: a re-subscribe is a deliberate action, not an accidental retry. Documenting so future debugging doesn't panic about it.

6. **Phase 1.4 schema additions — done** (migration `20260531120000_phase_1_4_schema`).
   Resolved: `deleted_at` soft-delete on `subscriptions`; cascade for the two config
   tables; `donations` standalone (no session link); fresh-start cutover (no backfill,
   no prod data). **Remaining for later phases:** premium row limits (3 locations / 3
   recipients vs 1) are not DB-enforced — that's the Phase 2.4 `isPremium` gate.
   `verified_at` on recipients is unused until the Phase 2.5 verification flow.
   `subscriptions`/`donations` have no reader until Phase 2.
