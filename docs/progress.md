# Mawqit progress

**Last updated:** 2026-05-08 18:00
**Current phase:** Phase 0 — Exploratory pass and cleanup
**Currently working on:** 0.1 Repository orientation — producing docs/context/repo-map.md
**Blocked:** none

## Phase 0 — Exploratory pass and cleanup

- [x] 0.1 Repository orientation
- [ ] 0.2 Schema audit
- [ ] 0.3 Reminder pipeline trace
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

2026-05-08 — Phase 0 kickoff. Read CLAUDE.md, claude-code-instructions.md, PLAN.md.
              Wrote initial progress.md and docs/context/repo-map.md (section 0.1 complete).

## Blockers

(empty)

## Open questions for the project owner

- Soft-delete vs hard-delete for subscriptions and donations rows when a session is deleted via the existing delete-my-data flow. Current schema cascade-deletes everything; production may need to retain payment records for tax and chargeback purposes. Resolve before Phase 1.4 (schema migration).
- `src/lib/utils.ts` exists and exports the standard shadcn `cn()` helper, used by 7 components. CLAUDE.md forbids `utils.ts` filenames. Options for 0.7 cleanup: rename to `src/lib/class-names.ts` (or similar) and update imports, or carve out an explicit exception for shadcn-generated `cn`. No action this session — flagging for cleanup-pass discussion.
- `src/app/api/webhooks/resend/` directory exists but is empty. Confirm this is an intentional placeholder for the Phase 1.2 Resend inbound webhook and should remain as-is, vs. removed in 0.7 cleanup until the route is actually written.
