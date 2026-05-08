# CLAUDE.md

You are working on **Mawqit**, a web-first prayer reminder system for the five daily Muslim prayers. The project started as a CS-6795 (Cognitive Science) class project at Georgia Tech and is being migrated to a production app at `mawqit.app` with a free tier (Mawqit) and paid tier (Mawqit+).

The product thesis is grounded in cognitive science: task-initiation failures for time-sensitive recurring rituals are usually a problem of cognitive support, not motivation. The app reduces friction by delivering reminders through channels users already occupy (email, browser push, eventually SMS), avoiding context switching, and keeping responses lightweight. Anonymous session links are used in place of accounts.

This thesis is load-bearing. Several common SaaS patterns are off the table because they violate it. **Read "Anti-features" below before suggesting any feature.**

This file is loaded automatically at the start of every session. It contains only the must-know rules. Everything else lives in `docs/` and is read on demand.

---

## Session-start protocol

At the start of every session, in order:

1. Read `docs/progress.md` to learn current phase, what's in progress, and any open questions or blockers.
2. Read `docs/claude-code-instructions.md` for the full operating manual.
3. Read whichever task-specific docs are relevant (use the doc index below).

Don't skip step 1. `progress.md` is the single source of truth for project state.

---

## Anti-features (do not build, do not suggest)

These violate the cognitive-science thesis or the product's privacy/anonymity posture. Surface a conflict and ask before doing anything in this list:

1. **No completion verification or prayer tracking.** The app does not know whether the user actually prayed. Don't add anything that infers it.
2. **No streaks, scores, badges, or gamification.** The thesis explicitly rejects penalizing inconsistency.
3. **No social features.** No sharing, no leaderboards, no friends list, no community feed.
4. **No auto-renewing subscriptions.** Renewal is affirmative — user clicks an email link to confirm. Stripe products are configured as one-time payments, not recurring subscriptions.
5. **No tracking pixels in emails.** No open/click tracking on reminder emails. Privacy posture is a differentiator.
6. **No analytics that fingerprint users.** Plausible (when enabled) is privacy-respecting; nothing else gets added without explicit approval.
7. **No required accounts.** The anonymous session model is locked in across both tiers.
8. **No engagement-driving notifications** ("we miss you", "come back", weekly digests, etc.). Reminders are for prayer times only.
9. **No paywall on the act of being reminded to pray.** Free tier always sends prayer reminders. Premium adds convenience and customization, never withholds the core function.
10. **No SMS in Phase 1 or Phase 2.** SMS comes in Phase 3, requires A2P 10DLC, and has a 100/month hard cap.

If a request would create one of these, push back. The user has explicitly said the app should not become "another prayer tracker."

---

## Locked-in decisions

| Item | Value |
|---|---|
| Domain | `mawqit.app` |
| Free tier | Mawqit |
| Paid tier | Mawqit+ |
| Pricing | $2.99/mo · $7.99/quarter · $14.99/6-month · $24.99/year |
| Renewal model | **Affirmative renewal**, never auto-renew |
| Free session validity | 30 days |
| Paid session validity | 180 days |
| Donation amounts | $5 · $10 · $25 · custom (Stripe Payment Links) |
| Account model | Anonymous sessions; Stripe customer is the recovery anchor for paid users |

If a request conflicts with one of these, surface the conflict and ask before changing course.

---

## Non-negotiable rules

These apply to every action you take in this repo:

- **Update `docs/progress.md` at the end of every session.** Update the timestamp, current task, tick completed checkboxes, add an activity-log entry, log any new blockers or open questions. If your work isn't in `progress.md`, it didn't happen.
- **At the end of every phase, write a phase summary** at `docs/phases/phase_<n>_summary.md` before declaring the phase done. Plain-English explanation of what was built, concepts introduced, why the choices were made, concrete verification steps with expected output, and a heads-up for the next phase. Full structure in `docs/claude-code-instructions.md`.
- **Phase 0 is exploratory.** No functional code changes. The only allowed changes are behavior-preserving cleanup (dead code, unused imports, orphaned files). The cleanup ships as one PR titled `chore: phase 0 cleanup`.
- **Acceptance gates between phases are not optional.** Friends-and-family validation runs between Phase 1 and 2, and again between Phase 2 and 3. Do not start the next phase until the gate passes.
- **Grep before writing new functions or modules.** If similar functionality exists, use it or refactor it. Duplicate functions are a serious failure mode.
- **No `utils.ts`, `helpers.ts`, `common.ts`, `misc.ts`, `lib/util.ts`, `lib/common.ts`.** Files have real names that describe what's inside.
- **Comments explain *why*, not *what*.** If a comment restates the code, delete it. TypeScript types and good names carry the documentation.
- **Conventional Commits format.** `<type>(<scope>): <description>`. Examples: `feat(cron): add affirmative renewal flow`, `fix(inbound): verify Resend webhook signature`.
- **Tests ship with the code.** No PR without tests except pure docs/config changes.
- **Mock modes are sacred.** `WEB_PUSH_MODE`, `EMAIL_FORCE_MOCK`, and the future `WEB_SMS_MODE` exist so the cron pipeline can be exercised without paying for real sends. Never bypass them. Never write code that calls a real provider when in mock mode.
- **Idempotency is sacred.** The send ledger prevents duplicate reminders when the cron runs more than once. Never write a code path that sends without first checking the ledger.
- **Never expose debug routes in production.** `ENABLE_DEBUG_TOOLS=false` is the production default. Don't ship code that bypasses this.
- **Never log PII at info or debug level.** Recipient emails, phone numbers, and session IDs are sensitive. Hash, partial-mask, or omit.
- **Never commit secrets.** Never log them either, even at debug level.
- **Never force-push to `main`.** Never bypass CI. Never disable failing tests with `it.skip` or `describe.skip`.
- **When the docs are ambiguous and the cost of being wrong is high, ask first.** When the cost is low and the choice is reversible, proceed and document the assumption in the PR description and the activity log.

---

## Coding style — the spirit

The repo must read like a repo a human would write. A new contributor should be able to clone it cold and start contributing within 30 minutes without an AI agent. No AI slop is acceptable.

- Files answer one coherent question. Soft limit 400 lines, hard limit 600.
- No premature abstraction. Three concrete reminder channels refactored later beats one abstract `Channel` interface designed before any of them work end-to-end.
- Names describe what things are or do. `sendReminderViaEmail()`, not `processNotification()`.
- Delete dead code, unused imports, commented-out blocks, "just in case" helpers. Git remembers.

Full coding-style rules are in `docs/claude-code-instructions.md`. Read them.

---

## Doc index

Use this to find the right doc for the question at hand. Don't load everything — only what the current task needs.

| Doc | Read when |
|---|---|
| `docs/progress.md` | Always, at session start. |
| `docs/claude-code-instructions.md` | Always, at session start. |
| `docs/PLAN.md` | You need strategic context — what we're building, why, scope, phase plan. |
| `docs/context/repo-map.md` | You need to find a file or understand directory structure. *(Created in Phase 0.)* |
| `docs/context/schema.md` | You're touching the database. *(Created in Phase 0; updated as schema evolves.)* |
| `docs/context/pipeline.md` | You're touching the reminder pipeline, cron, or send ledger. *(Created in Phase 0.)* |
| `docs/context/inbound.md` | You're touching the inbound webhook or `handleInbound`. *(Created in Phase 0.)* |
| `docs/context/tests.md` | You're writing or extending tests. *(Created in Phase 0.)* |
| `docs/context/env.md` | You're touching environment variables or deployment config. *(Created in Phase 0.)* |
| `docs/phases/phase_<n>_summary.md` | You want to know what a previous phase built or why decisions were made. |
| `README.md` | Almost never; it's for new humans, not you. |

---

## Common commands

```bash
npm run dev              # Next.js dev server
npm run build            # prisma generate + production build
npm run start            # Run production server (after build)
npm run test             # Vitest unit tests (no DB required)
npm run test:watch       # Vitest in watch mode
npm run lint             # ESLint
npm run db:generate      # Regenerate Prisma Client
npm run db:migrate       # prisma migrate dev (create/apply migrations)
npm run db:push          # prisma db push (sync without migration files; dev only)
```

The cron route is exercised by hitting `GET /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET`. There is no built-in scheduler — an external service (or local curl) drives it.

---

## When stuck

Don't grind. If you've been stuck for a while:

1. Document the blocker in `docs/progress.md` under "Blockers."
2. Move on to other work that doesn't depend on the blocker.
3. The project owner sees the blocker on their next visit and decides.

---

## Final reminder

The docs are the contract. If something in the docs is wrong, **fix the doc first, then fix the code** — or both in the same PR. Don't let the docs and code drift; they are the same thing expressed differently.

If genuinely ambiguous, ask.
