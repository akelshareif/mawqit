# Mawqit progress

**Last updated:** 2026-05-08 19:30
**Current phase:** Phase 0 — Exploratory pass and cleanup
**Currently working on:** 0.3 complete; 0.4 Inbound and channel logic is next
**Blocked:** none

## Phase 0 — Exploratory pass and cleanup

- [x] 0.1 Repository orientation
- [x] 0.2 Schema audit
- [x] 0.3 Reminder pipeline trace
- [ ] 0.4 Inbound and channel logic
- [ ] 0.5 Test coverage map
- [ ] 0.6 Environment and deployment
- [ ] 0.7 Repo cleanup
- [ ] 0.8 Outputs of Phase 0 written

## Phase 1 — Production hardening

- [ ] 1.1 Domain and email infrastructure
- [ ] 1.2 Wire inbound email
- [ ] 1.3 Prayer-time correctness
- [ ] 1.4 Schema migration
- [ ] 1.5 Observability
- [ ] 1.6 Legal and data
- [ ] 1.7 Rate limiting and abuse hardening
- [ ] 1.8 Friends-and-family feedback channel

## Phase 2 — Mawqit+ tier (no SMS yet)

- [ ] 2.1 Stripe foundation
- [ ] 2.2 Checkout flow
- [ ] 2.3 Affirmative renewal flow
- [ ] 2.4 Premium feature gate helper
- [ ] 2.5 Premium features (calendar feed, custom copy, extended validity, multi-location, multi-recipient)
- [ ] 2.6 Donations
- [ ] 2.7 Upgrade prompts and feature discovery

## Phase 3 — Pre-public-launch

- [ ] 3.1 SMS via Twilio
- [ ] 3.2 SMS feature configuration
- [ ] 3.3 i18n
- [ ] 3.4 Marketing and SEO surface
- [ ] 3.5 Pre-launch QA
- [ ] 3.6 Masjid outreach kit

## Recent activity

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

(empty)

## Open questions for the project owner

- `src/app/api/webhooks/resend/` directory exists but is empty. Project owner is unsure of intent. Default plan: leave it untouched in 0.7 (do not remove, do not write a route into it) and revisit at the start of Phase 1.2 when the real inbound webhook is wired. If the project owner reaches a decision earlier, log it here.

## Resolved decisions

- **Vercel project config:** managed entirely through the Vercel dashboard. No `vercel.json` expected in repo. (2026-05-08)
- **Cascade-delete on session deletion:** soft-delete `subscriptions` and `donations` rows so payment records survive for tax and chargeback purposes. To be implemented in Phase 1.4 schema migration. (2026-05-08)
- **`src/lib/utils.ts` rename:** rename in the 0.7 cleanup pass and update the 7 importers. (2026-05-08)
