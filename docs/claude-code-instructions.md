# `claude-code-instructions.md` — Working Instructions for Claude Code

**Read this at the start of every session.** It's how you operate in this repo.

If anything below conflicts with what a user asks for in-session, ask first — don't silently override these rules.

---

## Session start: read order

Every session, in this order:

1. **`docs/progress.md`** — current phase, what's in progress, what's blocked, open questions for the project owner.
2. **`docs/PLAN.md`** §§ relevant to the current phase — strategic context for what you're about to do.
3. **The doc(s) most relevant to the task** — `docs/context/schema.md`, `docs/context/pipeline.md`, `docs/context/inbound.md`, etc., once those exist.

You do not need to read every doc every session. Use `CLAUDE.md`'s doc index to find the right one for the task.

---

## The pulse: `progress.md`

`progress.md` is the single source of truth for project state. **If your work isn't reflected there, it didn't happen.**

- **At session start:** read it. Note "currently working on" and any blockers or open questions.
- **During the session:** if you finish a checklist item, tick its box.
- **At session end (mandatory):** add an entry to the "Recent activity" log with the date and a one-line summary. Update "Currently working on." If something is blocked, log it in "Blockers." If you need a decision from the project owner, log it in "Open questions."

Activity log entries are dated and chronological, most-recent first. Format:

```
2026-04-29 — Wired Resend inbound webhook to /api/inbound/email (PR #14).
              STOP/HELP confirmed working from Gmail. Outlook test pending.
```

Keep entries terse. Two lines max.

If `progress.md` does not exist yet (e.g., you are partway through Phase 0), create it. The structure is below.

### `progress.md` structure

```markdown
# Mawqit progress

**Last updated:** YYYY-MM-DD HH:MM
**Current phase:** Phase N — name
**Currently working on:** one-line description
**Blocked:** none | brief description

## Phase 0 — Exploratory pass and cleanup

- [ ] 0.1 Repository orientation
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

(... Phase 2 and 3 same pattern ...)

## Recent activity

YYYY-MM-DD — newest entry on top
YYYY-MM-DD — older entry

## Blockers

(empty if none)

## Open questions for the project owner

(empty if none)
```

---

## Scoping work

**Pick the smallest unit that ships and finish it.** Don't leave half-done work straddling sessions.

A "unit that ships" usually means:
- A passing test (or a passing test suite).
- A working API route end-to-end.
- A complete UI component with tests.
- A migration that applies cleanly forward and backward.
- A documentation file written and linked from the doc index.

If a task is too big to ship in one session, break it down at the start of the session and write the breakdown into `progress.md` so subsequent sessions can pick up where you left off.

**Don't refactor opportunistically.** If your task is "wire the inbound email webhook," and you notice a function elsewhere that "looks weird," leave it alone. File an open question or note for later. Refactors are their own scoped tasks.

The one exception is Phase 0, which has cleanup as an explicit goal. Even there, cleanup must be behavior-preserving — if a refactor would change behavior (even subtly), skip it and flag it for later.

---

## When to ask vs. proceed

**Ask** when:
- The relevant doc (`PLAN.md`, schema notes, etc.) is silent on the question.
- The cost of being wrong is high — anything affecting the data model, the cron pipeline, the send ledger, payments, the inbound handler, or auth.
- Two reasonable options exist with no clear winner from the docs.
- The request would create one of the anti-features in `CLAUDE.md`.

**Proceed and document** when:
- The docs are clear and you're implementing them.
- The choice is reversible — variable name, internal helper structure, file organization within an established directory.
- A sensible default exists and the cost of being wrong is a quick refactor.

**When you proceed without asking, document the assumption.** It goes in the PR description and the activity log entry. Future readers — including the project owner — should be able to see what you decided and reverse it if needed.

When a question accumulates in `progress.md` without a response, **don't block on it.** Move on to other work. The project owner sees the question on their next visit and decides.

---

## Coding style — the rules that matter most

The repo must be **a repo a human would write.** A new contributor should be able to clone it cold, read for 30 minutes, and start contributing meaningfully. No AI slop is acceptable.

These rules are non-negotiable.

### Before you write a new function or file, grep first

Search the codebase for existing functions doing similar work. If `sendEmailReminder` exists, use it. If something close exists, refactor it to fit your new need rather than create a parallel version. Duplicate functions are a serious failure mode — they fragment the codebase and ensure that the next bug fix won't propagate.

If you find yourself naming something `sendEmailV2`, `sendEmailWithRetry`, `dispatchEmail` alongside an existing `sendEmailReminder`, stop. There should be one canonical function.

### File organization

- **No `utils.ts`, `helpers.ts`, `common.ts`, `misc.ts`, `lib/util.ts`, `lib/common.ts`.** These names are admissions of giving up on organization. If functionality belongs somewhere, it has a real home: `lib/prayer-times.ts`, `lib/cron/persistence.ts`, `lib/channels/email/send.ts`. Names describe what's inside.
- **Files answer one coherent question.** If you can describe a file in one short phrase ("Resend inbound webhook handler," "ICS calendar feed generator"), it's coherent. If you can't, the file is either too small (merge it) or too big (split it).
- **Soft file-size limit: 400 lines. Hard limit: 600 lines.** When you hit the soft limit, that's a signal to think about whether the file has grown beyond a single concept.
- **God files are forbidden.** If `lib/cron.ts`, `lib/channels.ts`, or any route file is growing toward 1000 lines, split it before it gets there.
- **Follow the App Router convention for routes.** `app/api/cron/reminders/route.ts`, not a parallel registry. Co-locate route-only logic in the route file; extract to `lib/` only when shared.

### Don't over-abstract

- **No premature abstraction.** Don't build a generic `ReminderChannel` interface to cover the case of three hypothetical future channels. Three concrete channel implementations (email, push, SMS), refactored into a shared interface once the pattern is real, beats one interface designed before any channel works end-to-end.
- **No wrapper functions that don't add value.** If `function fetchUrl(url) { return fetch(url) }` is the entire wrapper, just call `fetch` directly.
- **Inline before extracting.** If a piece of logic is used in one place, leave it inline. Extract only when there are at least two callers, or when the extraction makes the original site materially cleaner.

### Comments

- **No comments that restate the code.** `// increment counter` above `counter += 1` is forbidden. Comments exist for the **why**, rarely for the **what**.
- **Comments earn their place when:** explaining a non-obvious tradeoff, documenting a workaround for an external bug (Resend quirk, browser push spec edge case, Twilio A2P rule), or flagging surprising context that future readers couldn't infer from the code itself.
- **JSDoc on public exports, only when it says more than the signature.** A function `function normalizeEmail(value: string): string` doesn't need a comment saying "Normalize an email." It does need one if there's non-obvious behavior worth flagging — strips dots from gmail addresses, lowercases, etc.
- **Type signatures + good names = most documentation.** If you find yourself writing JSDoc to explain what arguments mean, the argument names are probably wrong.

### Names

- **Names describe what the thing is or does.** `processData()` is bad. `sendReminderForPrayer()` is good. `x = something()` is bad. `hijriDate = computeHijriFromGregorian(date)` is good.
- **No abbreviations except universally known ones** (`url`, `id`, `db`, `tz`). `usrCtx` is bad; `userContext` is good.
- **Boolean names read as predicates:** `isPremium`, `hasActiveSubscription`, `shouldRetry`. Not `premium`, `subscriptionActive`, `retry`.
- **Avoid Hungarian notation and type prefixes.** TypeScript handles that.

### Dead code

- **Delete commented-out code immediately.** Git remembers. The codebase doesn't have to.
- **Delete unused imports.** ESLint catches these in CI; don't even let them reach a commit.
- **Delete "just in case" helpers, parameters, and code paths.** YAGNI. If something is needed later, write it later — it'll be better-shaped because the need is real.

### The pre-commit checklist (run mentally before every commit)

1. Did I grep for existing functions doing similar things?
2. Did I delete dead code, unused imports, commented-out blocks?
3. Are file sizes reasonable (under 400 lines for new files, well under 600 always)?
4. Do my variable and function names describe what they hold or do?
5. Did I add comments only where the *why* is non-obvious?
6. Would a new human contributor reading this code understand it without my context?
7. Did I update `progress.md`?

If any answer is "no" or "I'm not sure," fix it before committing.

---

## Commits

[Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short description>

[optional body explaining why, not what]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.

Scopes (examples): `(cron)`, `(inbound)`, `(channels/email)`, `(channels/push)`, `(stripe)`, `(schema)`, `(ui)`, `(docs)`.

### Pragmatic commit splitting

- **One commit per coherent unit of change**, not one commit per file.
- A change that adds the renewal-confirm token route and its tests is **one commit** (`feat(stripe): add renewal-confirm token route`), not two.
- A change that touches the schema *and* the cron is **two commits** — the concerns are different.
- If a commit's diff would be more readable as 2–5 logical pieces, split it. Don't force-split tiny diffs into multiple commits just for ritual.

### Branch naming

`feat/short-description`, `fix/short-description`, `docs/short-description`, `chore/short-description`. Kebab-case. No long branch names.

### PRs

- All work goes through PRs, even solo. PRs gate on CI passing.
- PR description must include: what changed, why, any assumptions made (especially when proceeding without asking), test coverage notes.
- Default merge strategy: squash merge. The PR title becomes the squash-commit message and must follow Conventional Commits format.

---

## Code quality non-negotiables

These are CI-gated. They block merges when failing.

- **`npm run lint`** passes (ESLint, including `eslint-config-next`).
- **`tsc --noEmit`** passes (TypeScript strict mode).
- **All tests pass** (`npm test`).
- **`npm run build`** completes (validates Prisma generation and Next.js build).
- **No flaky tests.** A flaky test is a broken test. Fix it or delete it; do not retry it.
- **No silent failures.** Caught exceptions get logged or re-raised. `catch (e) {}` is forbidden unless followed by an explicit comment explaining why and what was suppressed.
- **No silent data loss.** Code paths that drop reminders, skip recipients, or ignore errors must log structured records of what happened.

---

## Tests are part of the change

Every code change ships with the tests that cover it. No PR ships without tests, except for:

- Pure documentation changes.
- Configuration-only changes (Dockerfile, CI yaml, Vercel config) where the change is verified by the build itself.
- Pure refactors where the existing tests cover the new structure (still verify they still pass).

Vitest is the test runner. Prisma and external services are mocked in unit tests; the test suite does not require a live database.

When implementing a feature, write tests first when possible: red, then green. Especially for the cron pipeline, the send ledger, the renewal flow, and premium feature gating — these are the areas where regressions are most expensive.

---

## Working with secrets and credentials

- **Never commit secrets.** Resend API keys, VAPID private keys, Stripe webhook secrets, `CRON_SECRET`, `ADMIN_PASSWORD`, etc., live in `.env` (gitignored).
- **Never echo secrets in logs.** Even at debug level. Even temporarily. Even when "I'll remember to remove it before committing."
- **Never log PII at info or debug level.** Recipient emails, phone numbers, and full session IDs are sensitive. Hash, partial-mask (`abc***@gmail.com`), or omit. Stripe customer IDs are okay because they are opaque.
- **Use `.env.example`** as the template for what variables are needed. Never put real values there.
- **If you accidentally commit a secret**, treat it as compromised: rotate it, force-push the cleaned history (only with explicit project-owner approval), and log the incident.

When in doubt about whether something is sensitive, ask.

---

## Working with external services

These rules apply to every outbound call from the cron pipeline, the inbound webhook handler, or any payment route:

- **Mock modes are sacred.** `WEB_PUSH_MODE=mock`, `EMAIL_FORCE_MOCK=true`, and the future `WEB_SMS_MODE=mock` exist so the cron can be exercised in dev and test without paying for real sends. Code that ignores these flags is broken.
- **Idempotency is mandatory.** The send ledger prevents duplicate reminders when cron runs more than once. Every new send code path checks the ledger before sending and writes to it after.
- **Webhook signatures must be verified.** Resend inbound, Stripe webhooks, and (later) Twilio webhooks all sign their requests. Verify the signature before trusting the payload. Reject unsigned or invalid-signature requests with `401`.
- **Webhook idempotency keys.** Stripe and Resend may retry. Process each event ID once.
- **Per-provider rate limits.** Resend's free tier caps at 100/day; Pro caps at the plan limit. When near the cap, surface a structured warning and back off. Twilio enforces A2P throughput.
- **Honor 410 / 404 from push services.** Web Push subscriptions go stale; existing code already cleans these up. Don't bypass.
- **Signed tokens for any user-clickable link that triggers state change.** Calendar feed URLs, renewal-confirm links, recovery links, and one-click unsubscribe links all use signed JWTs (or equivalent). Token rotation must be possible per session.
- **Never store full card data.** Stripe handles card capture. We store the customer ID and subscription metadata, never PAN or CVV.

---

## Updating `progress.md` at session end

**Mandatory at the end of every working session.** Required updates:

1. **Top status block** — update "Last updated" timestamp, "Currently working on," and "Blocked" if applicable.
2. **Phase section** — tick any newly-completed checkboxes.
3. **Recent activity log** — add a new entry at the top with the date and a 1–2 line summary. Reference PR numbers if applicable.
4. **Blockers** — log any new blockers encountered.
5. **Open questions for the project owner** — log anything you couldn't decide and proceeded with an assumption on, or any genuine ambiguity that needs resolution.

If a session ended without shipping anything substantive (e.g., a long debugging session that didn't conclude), still log it: "2026-04-29 — Investigated cron timing regression; root cause unclear, will continue tomorrow."

---

## Phase-end protocol (mandatory)

When a phase reaches its acceptance gate, **before declaring it complete**, produce a phase summary at `docs/phases/phase_<n>_summary.md`. The phase isn't done without it.

The audience is the project owner — a developer who built the original Mawqit class project and is now learning production deployment, payments infrastructure, observability, and SaaS operational patterns through this migration. Treat the summary as teaching, not box-ticking.

**Required structure:**

1. **What was built (plain English).** 3–5 paragraphs of prose, not bullets. Explain what the system can now do that it couldn't before. Connect concepts. Show how the pieces fit together. Mention where this slots into the larger plan.

2. **Concepts introduced.** Anything new this phase that the project owner might not already know — A2P 10DLC, idempotent webhooks, signed JWTs, structured logging, Sentry source maps, Stripe webhook event ordering, etc. One short paragraph per concept, with a one-line plain-English definition. Skip concepts already familiar from the original class project.

3. **Why the choices were made.** Brief rationale for the non-obvious decisions in this phase. Why this library over that one, why this pattern, why this trade-off. Not exhaustive — only the choices a curious reader would wonder about.

4. **Verification steps.** Concrete commands the project owner can run, in order, with expected output. One section per acceptance-gate bullet from `PLAN.md`. Each step says: what to run, what to look for, what counts as "passed." Be specific — don't say "verify the tests pass," show the command and a snippet of the expected output. If something needs to be checked in a UI (Sentry dashboard, Stripe dashboard, Resend logs), give the click-path.

5. **Heads-up for the next phase.** One short section noting anything the next phase will materially change or build on. Examples: "Phase 2 will introduce real Stripe charges — `STRIPE_SECRET_KEY` must be set in production env." or "Phase 3 will add SMS, which requires A2P 10DLC registration that takes 10–15 days; start that before any other Phase 3 work."

**Tone:** clear, direct, slightly informal. Like explaining to a colleague who's smart and built the original codebase but may not have shipped a paid SaaS before. No condescension, no fluff.

**Length:** somewhere between 800 and 2000 words. Long enough to actually teach; short enough to read in one sitting.

After the summary is written, update `docs/progress.md`:
- Tick the phase's acceptance-gate checkboxes.
- Add an activity log entry: "2026-04-29 — Phase 1 complete. Summary at docs/phases/phase_1_summary.md."

The summary doc is committed to the repo. It becomes part of the project's history.

---

## Hard prohibitions

Non-negotiable. Do not do any of these without explicit project-owner approval:

1. **Don't force-push to `main`.** Ever.
2. **Don't bypass CI.** No `[skip ci]` flags except for pure docs changes.
3. **Don't expose debug routes in production.** `ENABLE_DEBUG_TOOLS=false` is the production default; do not ship code that bypasses this.
4. **Don't add auto-renewing subscriptions.** Affirmative renewal is locked in. Stripe products are configured as one-time payments.
5. **Don't add features from the anti-features list in `CLAUDE.md`.** Streaks, completion tracking, gamification, social features, engagement-driving notifications, tracking pixels — all off the table.
6. **Don't change the anonymous session model.** The session URL is the credential. No password-based accounts.
7. **Don't break cron idempotency.** The send ledger guarantees that a reminder fires at most once per cycle. Code paths that bypass the ledger are broken.
8. **Don't bypass mock modes.** When `WEB_PUSH_MODE=mock` or `EMAIL_FORCE_MOCK=true`, real provider calls must not happen.
9. **Don't commit secrets.** Already covered above; restating because the consequences are severe.
10. **Don't run destructive operations against production** without a written-out plan in `progress.md` and explicit approval. This includes truncating tables, dropping columns, mass-updating rows, deleting users.
11. **Don't add new top-level dependencies without justification.** Each dependency is a maintenance burden. Before adding one, check that an existing dependency or stdlib doesn't cover the need. Document the justification in the PR description.
12. **Don't rename or remove docs in `docs/` without project-owner approval.** Other docs may link to them; the doc index in `CLAUDE.md` may reference them.
13. **Don't ignore failing tests by marking them `it.skip` or `describe.skip`.** Either fix them or delete them. Skips accumulate and rot.
14. **Don't create files just because they "feel like they should exist."** Every file earns its place by holding meaningful, scoped functionality.
15. **Don't log PII at info or debug.** Hash, mask, or omit.

---

## When stuck

When you've been stuck on something for a while:

1. **Document the blocker.** Write into `progress.md`'s "Blockers" section: what you're trying to do, what you've tried, what's not working, what would unblock you.
2. **Move on to other work.** Don't spin on a single problem for hours. There's almost always parallel work that doesn't depend on the blocker.
3. **Wait for the project owner's input.** They'll see the blocker on their next visit.

Don't grind. The project's pace is set by progress on the highest-leverage tasks, not by minutes-on-keyboard. Stuck-time is wasted-time.

---

## A final note on what success looks like

The handoff package (this doc, `CLAUDE.md`, `PLAN.md`, the `docs/context/*.md` files produced in Phase 0, and the phase summaries that accumulate as work progresses) is the contract. Your job is to translate that contract into working software, ship it incrementally, and keep the contract honest as you go.

If something in the docs turns out to be wrong, **fix the doc first, then fix the code** (or do both in the same PR). Don't let docs and code drift; they're the same thing, expressed differently.

If you need help — genuine ambiguity, a gap in the spec, a contradiction between two docs — ask. The project owner would rather answer one question now than fix five wrong assumptions later.
