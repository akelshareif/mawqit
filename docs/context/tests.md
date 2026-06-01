# Test coverage map (Phase 0.5)

What's tested today, what isn't, and what Phase 1 will need to add. Update this doc whenever the test surface materially changes.

## Run summary

```
$ npm test
> mawqit@0.1.0 test
> vitest run

 RUN  v4.1.2 /Users/ake/Code/mawqit

 Test Files  37 passed (37)
      Tests  100 passed (100)
   Duration  ~1.25s
```

All tests pass. No flaky tests. No `it.skip` / `describe.skip`. The suite is fast (~1s) because everything is in-process — no live database, no real provider calls.

## Test runner

- **Vitest 4** ([`vitest.config.ts`](../../vitest.config.ts), [`vitest.setup.ts`](../../vitest.setup.ts)).
- **jsdom** environment for the React component tests; node for everything else (vitest auto-picks based on file shape).
- **`@testing-library/react`** + **`@testing-library/jest-dom`** matchers, registered in [`vitest.setup.ts`](../../vitest.setup.ts).
- Prisma is mocked per-test with hand-written `vi.fn()` stubs — never an in-memory DB, never a real DB. The same applies to Resend and web-push.

## Coverage by area

### Cron pipeline (smoke-only)

| Source | Test | What's covered |
|---|---|---|
| `app/api/cron/reminders/route.ts` | `route.test.ts` | 401 on invalid bearer secret. **No happy-path test.** |
| `lib/reminders/run-email-reminders.ts` | `run-email-reminders.test.ts` | One case: empty session list returns zero counters. No prayer-time-passed branch, no STOP-disabled, no provider-failure rollback. |
| `lib/reminders/run-browser-reminders.ts` | `run-browser-reminders.test.ts` | Same — empty subscriptions only. |
| `lib/reminders/run-persistence-pass.ts` | `run-persistence-pass.test.ts` | Same — empty cycles only. |
| `lib/reminders/run-expiry-pass.ts` | `run-expiry-pass.test.ts` | Same — empty session list only. |
| `lib/reminder-cycle.ts` | `reminder-cycle.test.ts` | `isReminderCycleStale` for missing-coords/timezone and day-mismatch only. **No "stale because next prayer passed"** test. |

The cron-pass tests are smoke tests that prove the function executes against a stubbed Prisma without throwing. They do **not** cover the claim-then-send ledger flow, the rollback-on-failure path, the 410/404 push cleanup, the resend-due/followup-due math, or the stale-cycle culling logic. **Phase 1.5** (observability) and **Phase 2** (renewal flow) will both lean heavily on these pipelines and need real test coverage before shipping.

### Inbound

| Source | Test | What's covered |
|---|---|---|
| `lib/inbound/handle-inbound.ts` | `handle-inbound.test.ts` | 4 cases: no-session, STOP-email happy path, empty body, no-active-cycle. **Not covered:** HELP, generic-ack happy path, no-timezone, outbound reply provider integration. |
| `app/api/debug/simulate-inbound/route.ts` | `simulate-inbound/route.test.ts` | One case: 404 when debug tools disabled. **No happy-path through to `handleInbound`.** |

### Providers

| Source | Test | What's covered |
|---|---|---|
| `lib/providers/email.ts` | `providers/email.test.ts` | One case: `createMockEmailProvider` writes a `message_log` row. **`createResendEmailProvider` is not tested.** |
| `lib/providers/web-push.ts` | `providers/web-push.test.ts` | One case: mock mode writes `message_log` only. **The real path (incl. 410/404 → `gone: true`) is not tested.** |

### API routes

| Source | Test | What's covered |
|---|---|---|
| `POST /api/sessions` | `sessions/route.test.ts` | Happy-path session create only. No rate-limit assertion. |
| `GET /api/sessions/[id]` | `sessions/[sessionId]/route.test.ts` | 404 + happy path |
| `DELETE /api/sessions/[id]` | same file | 404 invalid id, success, 404 not-found |
| `POST /api/recover` | `api/recover/route.test.ts` | 6 cases — generic-message, success, send-failure, missing-contact, invalid-email, normalized-email-lookup. The most thoroughly tested route. |
| `GET /api/health` | `api/health/route.test.ts` | DB-skipped, query-success, query-fails-503 |
| `GET /api/push/vapid-public-key` | same dir | 503 when missing, key when set |
| `POST /api/sessions/[id]/reminders/ack` | **none** | **Untested.** Browser ack route. |
| `POST /api/push/subscribe` | **none** | **Untested.** |
| `POST /api/push/unsubscribe` | **none** | **Untested.** |
| `POST /api/sessions/[id]/debug/simulate-send` | **none** | **Untested.** Debug-only. |
| `PATCH /api/sessions/[id]` | **none** | **Untested.** Setup-payload write path. (`parseSetupPayload` itself has 5 unit tests.) |

### Components

| Source | Test | What's covered |
|---|---|---|
| `components/app-footer.tsx` | `app-footer.test.tsx` | No lost-link link, conditional donate link |
| `components/session-subnav.tsx` | `session-subnav.test.tsx` | Renders correctly, marks current page, debug-link visibility |
| `components/setup-form.tsx` | `setup-form.test.tsx` | Heading/save action, delete-section visibility per first-time-vs-existing |
| `components/share-session-card.tsx` | `share-session-card.test.tsx` | Renders + clipboard-copy |
| `components/browser-push-hint.tsx` | **none** | Untested. |
| `components/debug-session-tools.tsx` | **none** | Untested (debug-only). |
| `components/prayer-times-display.tsx` | **none** | Untested. |
| `components/prayer-times-preview.tsx` | **none** | Untested. |
| `components/recover-form.tsx` | **none** | Untested. |
| `components/service-worker-register.tsx` | **none** | Untested. |
| `components/ui/*` | **none** | Untested. (Shadcn primitives — fine.) |

### Lib utilities

Solid coverage:

| Source | Notes |
|---|---|
| `lib/calendar-date.ts` | YMD ↔ UTC midnight, format-in-tz |
| `lib/cron-auth.ts` | unset / exact match / wrong-token / length-mismatch |
| `lib/env.ts` | every env getter has at least one test |
| `lib/log-sanitize.ts` | redaction, UUID truncation, opaque-string redaction |
| `lib/normalize.ts` | email normalization happy and failure paths |
| `lib/prayer-method-options.ts` | known values + `isAllowedPrayerMethod` |
| `lib/prayer-preview.ts` | parse failures + happy path |
| `lib/prayer-times.ts` | **method maps + `resolvePrayerDate` only** — see "Gaps" |
| `lib/public-url.ts` | base-URL precedence, trailing-slash strip, `sessionUrl` |
| `lib/rate-limit-api.ts` | allowed / 429 |
| `lib/rate-limit-memory.ts` | window count + reset |
| `lib/recover-session.ts` | lookup-by-email, message_log writes |
| `lib/reminders/prayer-reminder-common.ts` | next-key-after, label, time-for-key, SALAH_KEYS length |
| `lib/request-ip.ts` | x-forwarded-for / x-real-ip / unknown |
| `lib/session-has-location.ts` | true/false branches |
| `lib/session-id.ts` | UUID format accept/reject |
| `lib/setup-payload.ts` | valid, non-object, no channel, invalid cadence |
| `lib/utils.ts` | `cn` merge + tailwind conflict |

### Lib without tests

| Source | Why not tested |
|---|---|
| `lib/db.ts` | Prisma client singleton — pure wiring |
| `lib/debug-notification-tag.ts` | Single string constant |
| `lib/logger.ts` | Wraps console; would need IO assertions |
| `lib/message-types.ts` | Constants only |
| `lib/push-client.ts` | Browser-only client helper |
| `lib/reminders/cron-clocks.ts` | Type definition only |
| `lib/reminders/sent-reminder.ts` | The `tryCreateSentReminder` ledger-claim helper. **Functional code that should be tested** — the P2002 fall-through behavior is core to the idempotency contract. Flag for Phase 1. |
| `lib/session-channel-status.ts` | The `syncChannelStatuses` function is real logic with the dual-writer interaction documented in `inbound.md`. **Should be tested.** Flag for Phase 1. |
| `lib/show-debug-notification.ts` | Browser helper |
| `lib/timezone-options.ts` | Static data |

### App routes / pages without tests

Every page under `src/app/`, plus `src/app/actions/start-session.ts`, has no test today. App-router pages are server components, which are tricky to unit-test; the pragmatic move is integration tests for them, which the project doesn't have. Phase 1.5 might consider adding a thin Playwright or Vitest+jsdom integration layer, but it's not mandatory — the current units exercise the underlying lib correctly.

## Gaps PLAN.md explicitly calls out for Phase 1

[PLAN.md §1.3](../PLAN.md) requires unit-test coverage for:

| Gap | Current state |
|---|---|
| **Asr juristic method (Standard vs Hanafi)** | Not exposed at all today. [`getCalculationParameters`](../../src/lib/prayer-times.ts:21) maps 5 string method values; none of the mappings touch `params.madhab`. The `Hanafi` toggle is an adhan parameter independent of `CalculationMethod`. Phase 1.3 needs to (a) add it to the schema or setup payload, (b) plumb it into `getCalculationParameters`, (c) write tests for both juristic settings against a known-day reference. |
| **DST spring-forward / fall-back** | Untested. `formatDateInTimeZone` and `resolvePrayerDate` use `Intl.DateTimeFormat` so DST should "just work," but there's no fixture-day test covering 2026-03-08 (US spring-forward), 2026-11-01 (US fall-back), or the corresponding EU dates. Phase 1.3 should add at least one test per direction. |
| **High-latitude rule (Middle of Night / Seventh of Night / Twilight Angle)** | Not exposed at all. Adhan supports it via `params.highLatitudeRule`. Same shape as Asr juristic — schema, setup payload, plumbing, tests. |
| **Premium gating** | Whole concept doesn't exist yet — see Phase 2.4 in PLAN.md. The `subscriptions` table lands in Phase 1.4; the `isPremium` helper lands in Phase 2.4 with required tests for active/expired/never-paid/future-period-end. No coverage owed in Phase 1. |

## Other gaps worth flagging

These aren't called out by name in PLAN.md, but they'll surface in Phase 1 or 2 work:

1. **No happy-path test for the cron pipeline.** Every cron-pass test asserts "empty input → zero output." Nothing exercises the actual send → ledger → cycle write → message_log path. The closest thing is the provider-mock tests, which test the bottom of the call stack in isolation. Phase 1.5 (observability) should add at least one end-to-end-ish test per pass that:
   - Seeds a session past a prayer time
   - Runs the pass with a mocked provider that returns success
   - Asserts a `sent_reminders` row, a `reminder_cycles` row, and a `message_log` row
   - Re-runs the pass and asserts no new rows (idempotency)

2. **No test for the rollback-on-failure path.** The contract is "failed send → delete the just-claimed `sent_reminders` row." If a future change skips this, no test catches it. High-leverage to fix: one test per pass with a provider that returns `{success: false}` and an assertion that the ledger is empty afterward.

3. **No test for `gone: true` push cleanup.** [`createWebPushProvider`](../../src/lib/providers/web-push.ts) returns `gone: true` for HTTP 410/404. The browser pass and persistence pass each have a `gone` branch that deletes the push subscription. Untested in both places.

4. **No test for `tryCreateSentReminder`'s P2002 fall-through.** [`sent-reminder.ts`](../../src/lib/reminders/sent-reminder.ts) catches Prisma's P2002 unique-constraint error and returns `null`. If a future Prisma upgrade changes the error code, the entire idempotency layer silently breaks. One unit test around `tryCreateSentReminder` would lock this.

5. **No test for `syncChannelStatuses`.** The dual-writer interaction with `handleInbound` is documented in [`inbound.md`](inbound.md) but untested. The "user re-enables in UI clears prior STOP" semantics is non-obvious and would be easy to break.

6. **No test for the `/api/sessions/[id]/reminders/ack` browser-ack route.** The route is the user-visible end of the persistence/ack contract. Phase 2 multi-recipient will touch the ack flow; coverage now would prevent regressions.

7. **No test for `PATCH /api/sessions/[id]`.** The `parseSetupPayload` unit tests cover validation, but they don't cover `syncChannelStatuses` getting called with the right flags, the `expiresAt` recomputation, the `expiry*SentAt` reset, or the rate limiter. One integration-shaped test would cover all four.

8. **No test for push subscribe / unsubscribe.** Both are simple routes, but they read JSON, do a DB write, and write a `push_subscriptions` row. A regression in either silently breaks the browser-push setup flow.

9. **`createResendEmailProvider` is untested.** Unit-testing it requires mocking the Resend SDK (`new Resend(apiKey).emails.send`). The error-shape parsing in [lines 86-92](../../src/lib/providers/email.ts) is the most fragile bit — flagged in [`pipeline.md`](pipeline.md) #6 as well.

## Things to revisit

1. **The cron-pass test files exist but are token coverage.** They claim to test the function but only assert the trivial empty-input case. A reader who sees `run-email-reminders.test.ts` in the file list would assume the email pass is covered. It's not, materially. Phase 1.5 needs to either expand them or replace them.

2. **No integration tests in the suite.** Everything is unit + mocks. This is fine for now (the mocks are honest about what they replace), but it means a regression in the wiring between the route, the lib, and Prisma can pass all 100 tests and still ship broken. Phase 1.5 might consider one or two end-to-end tests using a Postgres test container, even if the unit-test posture stays the default.

3. **No coverage report.** `vitest run --coverage` isn't configured. Adding it would make these gaps quantitative. Could be a 0.7 cleanup target if you want it before Phase 1, or a Phase 1.5 task as part of observability.

4. **No CI status check.** The repo has no `.github/workflows/` (verified during 0.1). Phase 1 will need GitHub Actions running `npm test`, `npm run lint`, `npm run build` on every PR before merging. This is implied by the "CI-gated" language in `claude-code-instructions.md` but isn't actually wired.
