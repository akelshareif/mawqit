# Mawqit progress

**Last updated:** 2026-06-02 11:00
**Current phase:** Phase 1 — Production hardening
**Currently working on:** 1.2 inbound email — code complete on branch feat/inbound-email-webhook (PR pending). `/api/inbound/email` wired to Resend (Svix signature verify + `email.received` body fetch + idempotency), plus a runbook for the 1.1/1.2 out-of-repo setup. 1.3 and 1.4 merged (PRs #6/#3). Remaining in Phase 1: 1.1 (owner: domain/DNS/Resend), 1.5, 1.6, 1.7, 1.8.
**Blocked:** none (1.2's production acceptance test awaits owner doing the out-of-repo setup in docs/runbooks/email-infrastructure-setup.md — tracked under Open questions, not a code blocker)

## Phase 0 — Exploratory pass and cleanup

- [x] 0.1 Repository orientation
- [x] 0.2 Schema audit
- [x] 0.3 Reminder pipeline trace
- [x] 0.4 Inbound and channel logic
- [x] 0.5 Test coverage map
- [x] 0.6 Environment and deployment
- [x] 0.7 Repo cleanup
- [x] 0.8 Outputs of Phase 0 written

## Phase 1 — Production hardening

- [ ] 1.1 Domain and email infrastructure
- [ ] 1.2 Wire inbound email
- [x] 1.3 Prayer-time correctness
- [x] 1.4 Schema migration
- [ ] 1.5 Observability
- [ ] 1.6 Legal and data
- [ ] 1.7 Rate limiting and abuse hardening
- [ ] 1.8 Friends-and-family feedback channel

## Phase 2 — Mawqit+ tier

- [ ] 2.1 Stripe foundation
- [ ] 2.2 Checkout flow
- [ ] 2.3 Affirmative renewal flow
- [ ] 2.4 Premium feature gate helper
- [ ] 2.5 Premium features (calendar feed, custom copy, extended validity, multi-location, multi-recipient)
- [ ] 2.6 Donations
- [ ] 2.7 Upgrade prompts and feature discovery

## Phase 3 — Pre-public-launch

- [ ] 3.1 i18n
- [ ] 3.2 Marketing and SEO surface
- [ ] 3.3 Pre-launch QA
- [ ] 3.4 Masjid outreach kit

## Recent activity

2026-06-02 — Phase 1.2 inbound email (code), on branch feat/inbound-email-webhook.
              Wired the real Resend inbound webhook at `/api/inbound/email`: Svix
              signature verification (manual HMAC-SHA256, `RESEND_WEBHOOK_SECRET`,
              new `verify-resend-webhook.ts`), `email.received` body fetch via
              `resend.emails.receiving.get` (webhook is metadata-only — new
              `fetch-received-email.ts`), and idempotency on the `svix-id`
              (claim/release + new `webhook_events` table, migration
              20260602120000). Route extracts the bare From address
              (`extractEmailAddress` in normalize.ts) then calls the existing
              `handleInbound`. Tests: verify (6), idempotency (4), route (7) — 127/127
              total. Wrote docs/runbooks/email-infrastructure-setup.md (the full
              out-of-repo runbook for 1.1 + 1.2: domain, DNS, Resend DKIM/SPF/DMARC,
              receiving MX, webhook endpoint, secret, end-to-end STOP test) and added
              it to the CLAUDE.md doc index. Updated env/inbound/schema context docs.
              Verified: tsc 0, lint 0, tests 127/127, build 0. NOTE: webhook_events
              migration must be applied (`prisma migrate deploy`) before the webhook
              goes live.

2026-06-01 — Phase 1.3 prayer-time correctness, on branch feat/prayer-correctness.
              Added two configurable Session fields: `asr_method` (standard/hanafi) and
              `high_latitude_rule` (middle-of-night/seventh/twilight-angle), threaded
              through getCalculationParameters → adhan Madhab/HighLatitudeRule and every
              caller (dashboard, preview, email/browser/persistence passes, reminder-
              cycle, inbound ack). Setup form: Asr radio + an Advanced disclosure for the
              high-latitude rule. New option modules + validators; setup-payload validates
              both, defaulting to adhan's prior implicit behavior so existing sessions are
              unchanged. Migration 20260601120000_prayer_correctness (additive). Tests
              added: Asr Hanafi-later-than-standard, DST spring/fall (NYC), high-latitude
              (Reykjavík), setup-payload validation. No Hijri display exists, so PLAN's
              "verify Hijri if displayed" is a no-op. Verified: tsc 0, lint 0, 110/110,
              build 0. NOTE: two migrations now await `prisma migrate dev` on the DB —
              remove_sms (PR #5) and this one.

2026-06-01 — SMS cut from scope entirely (owner decision: A2P 10DLC overhead not worth
              it for a solo launch; email + browser push cover the need). Removed on
              branch refactor/remove-sms (PR #5): deleted providers/sms.ts +
              normalizePhoneE164, made inbound/recover/persistence email-only, dropped
              `sms` from the ReminderChannel + RecipientType enums and the
              Session.sms_enabled column (migration 20260601000000_remove_sms — apply
              with `prisma migrate dev`). Scrubbed living docs (CLAUDE.md anti-feature
              #10 now "No SMS", PLAN.md Phase 3 renumbered, context docs). Historical
              entries below + phase_0 summary left as-is. Verified: tsc 0, lint 0,
              tests 100/100, build 0.

2026-05-31 — Phase 1.4 merged and live. Owner applied the migration to Neon
              (`prisma migrate status` = up to date) and merged PR #3. PRs #1/#2/#3 all
              merged; main at a053f87, tsc 0. Deleted the three merged local branches.
              Neon-offline blocker cleared. Next per PLAN: 1.1+1.2 (domain + inbound
              email), then 1.5 (observability).

2026-05-31 — Phase 1.4 cutover finished and verified green. The earlier cutover
              commits on feat/phase-1.4-schema (incl. 0478a86, whose message wrongly
              claimed green) actually still had 5 tsc errors and failing tests — a
              botched in-place edit left the email/expiry/persistence passes and pages
              half-converted. Completed it: email-reminders import, persistence/expiry
              relational reads, session-has-location helper, and the inbound / recover /
              session-has-location test fixtures. Verified one command at a time: tsc 0,
              lint 0, tests 108/108 (was 107 on main; +1 from a new session-has-location
              case — earlier "112" was a wrong figure), build 0. Send-ledger untouched.
              Migration still NOT applied to DB (Neon was offline); owner runs
              `prisma migrate dev` when it's up.
2026-05-31 — Phase 0 complete & gate passed. PR #1 merged to main as 7266f6e. Wrote the
              phase summary at docs/phases/phase_0_summary.md (what was built, concepts,
              rationale, verification steps, Phase 1 heads-up). Recovered a local-main
              divergence en route (stale pre-merge local main reset to origin/main).
              Next per PLAN execution order: Phase 1.4 schema migration first.

2026-05-31 — Phase 0 fully complete (0.1–0.8). Confirmed all seven docs/context/*.md
              outputs exist and match the codebase: repo-map, schema, pipeline, inbound,
              tests, env, cleanup. Ticked 0.7 and 0.8. Only the acceptance gate remains
              (owner review + merge of PR #1). No Phase 1 work until the gate passes.

2026-05-31 — Opened PR #1 (`chore: phase 0 cleanup`) → main. Local main had 9 unpushed
              Phase 0 docs commits while origin/main had a README deploy-link commit;
              reconciled by merging origin/main into the branch (README excluded from the
              PR diff). Per owner decision, the whole Phase 0 output (7 context docs +
              progress trail + cleanup) ships in this one PR rather than pushing docs to
              main directly. PR is mergeable; awaiting review (acceptance gate).

2026-05-31 — Section 0.7 complete. Behavior-preserving cleanup on branch
              chore/phase-0-cleanup. Renamed
              src/lib/utils.ts → class-names.ts (resolved decision; updated 7 importers,
              test, components.json alias), deleted 5 unused create-next-app SVGs (kept
              sw.js), removed stale BASE_URL from .env.example. No dep changes (depcheck
              hits all false positives), no dead-export removals (all used). Empty
              webhooks/resend dir left per open question. Wrote docs/context/cleanup.md.
              Verified: lint 0, tsc 0, test 107/107, build 0 (with DATABASE_URL set).

2026-05-31 — Section 0.6 complete. Wrote docs/context/env.md documenting all 21 env
              vars read by code (centralized in src/lib/env.ts), the mock-mode
              switches, and deployment (Vercel dashboard-managed, external cron driver,
              no CI, no pinned Node). Reconciled .env.example/README vs code: stale
              BASE_URL (remove in 0.7), and ADMIN_*/PLAUSIBLE_* declared but
              unimplemented (Phase 1.5 / 3.4). Flagged push-vs-email mock-fallback
              asymmetry and absent CI. NOTE: first env.md draft was committed with
              fabricated details (invented DIRECT_URL, a fail-open middleware, claimed
              no .env.example); corrected after verifying against real source.

2026-05-08 — Section 0.5 complete. npm test passes 107/107 across 38 files. Wrote
              docs/context/tests.md mapping every source file to its test file (or
              lack thereof). Cron-pass tests are token smoke tests only (each asserts
              empty-input → zero-output); the claim-then-send ledger flow,
              rollback-on-failure, and 410/404 push cleanup are all untested. PLAN.md
              §1.3 gaps confirmed: Asr juristic, DST, and high-latitude rules are
              completely uncovered, premium gating doesn't exist yet. Discovered
              setup-payload hard-codes smsEnabled=false / phoneNumber=null on every
              save — SMS is structurally dormant. No GitHub Actions workflows in
              repo. Corrected inbound.md flag #2: stored emails ARE normalized.

2026-05-08 — Section 0.4 complete. Wrote docs/context/inbound.md documenting
              handleInbound's 8 outcomes (invalid_address, no_session, stop, help,
              empty, no_timezone, no_active_cycle, ack), STOP/HELP/generic-ack flows,
              channel-status's three-state row model (no row / disabled=false /
              disabled=true), and the dual-writer pattern (syncChannelStatuses on
              save vs handleInbound on STOP). 9 items flagged. Also corrected
              pipeline.md flag #9: PATCH /api/sessions DOES reset expiry*SentAt
              columns on save (initial mis-read).

2026-05-08 — Section 0.3 complete. Wrote docs/context/pipeline.md tracing the cron
              entry point, the four-pass execution order (expiry → email → browser →
              persistence), the dual-clock model (realNow vs reminderNow), the
              claim-then-send ledger pattern with rollback-on-failure, the cycle table
              for follow-ups and resends, the 410/404 push cleanup path, and a full
              inventory of mock-mode env switches. 10 items flagged for "things to
              revisit," most prominent: there is no initial-pass for SMS so
              run-persistence-pass's SMS branch is unreachable until Phase 3.

2026-05-08 — Section 0.2 complete. Wrote docs/context/schema.md covering all 7 models,
              5 enums, cascade rules, the two partial unique indexes that enforce
              send-ledger idempotency, single-value fields earmarked for 1:N migration
              in Phase 1.4, and the 6 existing migrations. Owner resolved 3 open
              questions: Vercel managed via dashboard, soft-delete on payment rows,
              rename lib/utils.ts in 0.7. /resend webhooks dir remains open.

2026-05-08 — Phase 0 kickoff. Read CLAUDE.md, claude-code-instructions.md, PLAN.md.
              Wrote initial progress.md and docs/context/repo-map.md (section 0.1 complete).

## Blockers

(The 2026-05-31 Neon-unreachable blocker is resolved: the Phase 1.4 migration was
applied and `prisma migrate status` reports the schema up to date. **Pending DB
apply** (`prisma migrate dev` locally / `prisma migrate deploy` in prod): the
SMS-removal migration `20260601000000_remove_sms` (PR #5) and the new Phase 1.2
`20260602120000_webhook_events`. Both are additive/safe.)

## Open questions for the project owner

- **Phase 1.2 production cutover (action needed).** The inbound code is merged but
  receives nothing until the out-of-repo setup is done. Follow
  `docs/runbooks/email-infrastructure-setup.md` end to end (this is also Phase 1.1):
  register `mawqit.app`, DNS + Vercel domain, Resend domain verification
  (DKIM/SPF/DMARC), set `RESEND_API_KEY`/`RESEND_FROM`/`NEXT_PUBLIC_APP_URL`, enable
  receiving (MX), add the webhook endpoint → `/api/inbound/email` on `email.received`,
  set `RESEND_WEBHOOK_SECRET`, apply the `webhook_events` migration, then run the
  STOP/HELP acceptance test. Tick 1.1 and 1.2 once the real STOP test passes.

- ~~`src/app/api/webhooks/resend/` directory exists but is empty.~~ **Resolved
  (2026-06-02):** the real inbound route lives at `/api/inbound/email` (Phase 1.2).
  The empty `webhooks/resend/` dir is unrelated leftover scaffolding — left in place
  for now; safe to delete in a future cleanup pass (noted in inbound.md).

## Resolved decisions

- **Vercel project config:** managed entirely through the Vercel dashboard. No `vercel.json` expected in repo. (2026-05-08)
- **Cascade-delete on session deletion:** soft-delete `subscriptions` and `donations` rows so payment records survive for tax and chargeback purposes. To be implemented in Phase 1.4 schema migration. (2026-05-08)
- **`src/lib/utils.ts` rename:** rename in the 0.7 cleanup pass and update the 7 importers. (2026-05-08)
