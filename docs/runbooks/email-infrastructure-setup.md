# Runbook — Email infrastructure setup (Phases 1.1 + 1.2)

**Audience:** the project owner, doing the out-of-repo work that the code cannot do
for itself — registering the domain, configuring DNS, verifying the sending domain
in Resend, turning on inbound email, and wiring the inbound webhook.

This runbook is the companion to the code that landed in **Phase 1.2** (the
`/api/inbound/email` route and its signature/idempotency machinery). The code is
already merged and tested; it just sits idle until the steps below are done in your
real accounts. Work top to bottom — later steps depend on earlier ones.

Everything here happens in dashboards and DNS, not in this repo. The only repo-side
actions are setting environment variables in Vercel (Part D) and applying one
database migration (Part F).

> **Terminology.** Mawqit sends *outbound* reminders (Phase 1.1) and receives
> *inbound* replies like STOP/HELP (Phase 1.2). Both run through Resend on the same
> verified domain. "Sending domain" and "receiving domain" are the same domain
> (`mawqit.app`); they just use different DNS records.

---

## Prerequisites / accounts you need

| Thing | Where | Notes |
|---|---|---|
| Domain registrar account | Cloudflare Registrar or Porkbun | Cloudflare is recommended because DNS lives there too. |
| Cloudflare account | cloudflare.com | Holds the DNS zone for `mawqit.app`. |
| Vercel account + the Mawqit project | vercel.com | Already deployed; you'll add the custom domain and env vars. |
| Resend account | resend.com | Free tier is fine to start (100 emails/day). Inbound is included. |
| A few real test inboxes | Gmail, Outlook, Yahoo, iCloud | For the deliverability and STOP/HELP tests. |

Keep a scratch note open — you'll copy several secrets between dashboards.

---

## Part A — Register the domain (Phase 1.1)

1. Buy **`mawqit.app`** at Cloudflare Registrar (Dashboard → Domain Registration →
   Register Domains) or Porkbun. `.app` is on the HSTS preload list, so it is
   **HTTPS-only** by design — this is fine, the app is HTTPS everywhere.
2. If you bought it somewhere other than Cloudflare, add the domain as a **zone** in
   Cloudflare (Dashboard → Add a site) and update the registrar's nameservers to the
   two Cloudflare nameservers it shows you. Wait for the zone to go **Active**
   (minutes to a few hours).
3. Confirm you can see an empty-ish DNS table for `mawqit.app` in Cloudflare. That
   table is where every record below goes.

**Done when:** `mawqit.app` shows **Active** in Cloudflare and you can add DNS
records to it.

---

## Part B — Point the domain at Vercel (Phase 1.1)

1. In **Vercel → the Mawqit project → Settings → Domains**, add `mawqit.app` and
   `www.mawqit.app`.
2. Vercel will show you the DNS records it wants. For an apex domain (`mawqit.app`)
   on Cloudflare you have two options:
   - **A record** to Vercel's IP (`76.76.21.21`), or
   - **CNAME flattening** (Cloudflare lets you CNAME the apex to
     `cname.vercel-dns.com`).
   Either works. Add `www` as a **CNAME** to `cname.vercel-dns.com`.
3. **Proxy status:** set these records to **DNS only** (grey cloud), *not* proxied
   (orange cloud), while Vercel verifies and issues its certificate. You can revisit
   proxying later, but grey-cloud is the trouble-free default with Vercel.
4. Wait until Vercel shows the domain as **Valid / Ready** with a green check and an
   issued SSL certificate.

**Done when:** `https://mawqit.app` loads the app with a valid certificate.

> ⚠️ Do **not** let Cloudflare's proxy or "Always Use HTTPS"/page rules sit in front
> of the API routes in a way that strips the `Authorization` header or rewrites POST
> bodies — the cron endpoint needs the bearer token intact and the inbound webhook
> needs the **raw, unmodified** request body for signature verification. Grey-cloud
> (DNS only) avoids all of this.

---

## Part C — Verify the sending domain in Resend (Phase 1.1)

This is what lets Mawqit send email *from* `@mawqit.app` and not land in spam.

1. In **Resend → Domains → Add Domain**, enter `mawqit.app` (you can scope sending to
   a subdomain like `send.mawqit.app` if you prefer; the rest of this doc assumes the
   apex). Pick the region closest to your users.
2. Resend shows a set of **DNS records** to add. Add **all** of them in Cloudflare
   exactly as shown (copy/paste — a single wrong character fails verification). You
   will get:
   - **DKIM** — one or more `CNAME` (or `TXT`) records (e.g.
     `resend._domainkey…`). This signs your mail so receivers can verify it.
   - **SPF** — a `TXT` record on the sending domain/subdomain authorizing Resend's
     mail servers (and an `MX` record for the bounce/return-path subdomain Resend
     uses). SPF says "these servers may send as me."
   - Set these DNS records to **DNS only** (grey cloud) in Cloudflare.
3. Add a **DMARC** record yourself (Resend may not add it for you): a `TXT` record at
   `_dmarc.mawqit.app`. Start in monitor mode:
   ```
   _dmarc.mawqit.app  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@mawqit.app"
   ```
   `p=none` monitors without affecting delivery. Once SPF+DKIM are solid for a couple
   of weeks, you can tighten to `p=quarantine` then `p=reject`. DMARC tells receivers
   what to do when SPF/DKIM fail and where to send reports.
4. Back in Resend, click **Verify**. It can take a few minutes to a few hours for DNS
   to propagate. The domain flips to **Verified** when DKIM and SPF check out.

**Concepts in one line each:**
- **SPF** — a DNS list of servers allowed to send mail as your domain.
- **DKIM** — a cryptographic signature on each message proving it wasn't forged or
  altered.
- **DMARC** — your published policy for what receivers should do when SPF/DKIM fail,
  plus a reporting address.

**Done when:** Resend shows `mawqit.app` as **Verified**.

---

## Part D — Set production environment variables (Phase 1.1)

In **Vercel → Settings → Environment Variables** (Production scope), set:

| Variable | Value | Why |
|---|---|---|
| `RESEND_API_KEY` | a Resend **API key** (Resend → API Keys → Create) | Real sends + fetching inbound bodies. Keep it secret. |
| `RESEND_FROM` | `Mawqit <reminders@mawqit.app>` | The verified sender. Must be on the domain you verified in Part C. |
| `NEXT_PUBLIC_APP_URL` | `https://mawqit.app` | Canonical origin for session links in emails. |

Leave `EMAIL_FORCE_MOCK` unset (or `false`) in production so real sends happen. Keep
it `true` (or rely on the missing-credentials default) in local/dev so you never pay
for a real send while developing — this is a hard project rule.

Redeploy (or let the next push deploy) so the new env vars take effect.

**Done — acceptance test for Phase 1.1:** send a real test email from production to
**Gmail, Outlook, Yahoo, and iCloud** and confirm it lands in the **inbox, not
spam**. Easiest way: create a session on `https://mawqit.app` for each test inbox,
set a location, and let the cron fire a reminder (or trigger the cron manually per
the README). Check each provider. If something lands in spam, recheck SPF/DKIM/DMARC
and the `From` alignment (the `From` domain must match the DKIM/SPF domain).

---

## Part E — Turn on inbound email + wire the webhook (Phase 1.2)

Now make replies (STOP / HELP / "got it") actually reach the app.

### E1. Enable receiving on the domain

1. In **Resend → the `mawqit.app` domain → Receiving** (or **Emails → Receiving**),
   enable inbound. Resend will give you a **receiving address** to publish — this
   adds an **`MX` record** in Cloudflare pointing your domain (or a subdomain) at
   Resend's inbound servers. Add the `MX` exactly as shown, **DNS only** (grey
   cloud).
2. Decide the address users reply to. The simplest is to make `RESEND_FROM`'s address
   (`reminders@mawqit.app`) the receiving address, so a plain "Reply" to a reminder
   goes back to Resend inbound. Confirm in Resend that the address/route is set to
   deliver inbound mail to a webhook (next step).

> The app matches an inbound message to a session by the **sender's** address (the
> person replying), not the `To:` address — so any receiving address that funnels to
> the webhook works. Using the same address as `RESEND_FROM` is just the most
> intuitive for users hitting "Reply."

### E2. Create the webhook endpoint

1. In **Resend → Webhooks → Add Endpoint**, set the URL to:
   ```
   https://mawqit.app/api/inbound/email
   ```
2. Subscribe it to the **`email.received`** event (only that one is needed for
   inbound replies; the route ignores any other type with a 200).
3. Save. Resend shows a **Signing Secret** that starts with `whsec_…`. Copy it.

### E3. Set the webhook secret in Vercel

In **Vercel → Environment Variables** (Production), add:

| Variable | Value |
|---|---|
| `RESEND_WEBHOOK_SECRET` | the `whsec_…` value from E2 |

Redeploy so it takes effect. **Until this is set, the route rejects every inbound
delivery with `500` on purpose** (it fails closed rather than trust an unsigned
payload).

### E4. How the route behaves (for your mental model)

When someone replies to a reminder, Resend POSTs an `email.received` event to
`/api/inbound/email`. The route:

1. Rate-limits abusive senders (120/min per IP).
2. **Verifies the signature** over the raw body using `RESEND_WEBHOOK_SECRET`. A bad
   or missing signature → `401`; a missing secret → `500`.
3. **Dedupes** on Resend's delivery id, so a retried delivery is processed once.
4. **Fetches the email body** (the webhook itself carries only metadata) and hands
   STOP / HELP / acknowledgement handling to the existing inbound logic.

A reply of **STOP** disables email for that session; **HELP** replies with the
session link and help text; anything else acknowledges the current prayer reminder.

---

## Part F — Apply the database migration

Phase 1.2 added one table, `webhook_events` (the idempotency ledger). Apply the
migration to production **before** the webhook goes live:

```bash
# with the production DATABASE_URL available to the shell
npx prisma migrate deploy
```

Confirm with `npx prisma migrate status` → "Database schema is up to date."

(If you deploy migrations as part of your normal release flow, this just rides along
with the next deploy. The migration is additive and safe.)

---

## Part G — End-to-end acceptance test (Phase 1.2 "done")

1. Make sure a session exists whose **primary email** is one of your real test
   inboxes, and that the session has email reminders enabled.
2. Trigger a reminder to that inbox (cron, as in Part D).
3. From that inbox, **reply `STOP`** to the reminder.
4. Within a minute you should receive a **"Notifications for email have been
   stopped."** reply, and the session's email channel should now be **disabled** (no
   further email reminders fire for it).
5. Repeat with **`HELP`** → you should get the session link + help text back.
6. Re-enable email for that session from its settings page and confirm reminders
   resume (saving with email ticked clears the STOP).

**Phase 1.2 is done when:** replying `STOP` from a real email account to a real
reminder disables that channel for that session in production.

### Quick troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Webhook deliveries show `500` in Resend's logs | `RESEND_WEBHOOK_SECRET` unset or wrong | Set the exact `whsec_…` from the endpoint; redeploy. |
| Deliveries show `401` | Secret mismatch, or a proxy altered the body | Re-copy the secret; ensure Cloudflare is **DNS only** (grey cloud) for the app so the raw body is untouched. |
| `200` but nothing happens (`no_session`) | The replying address doesn't match the session's primary email | Check the session's primary recipient equals the sender, lowercased. |
| No webhook delivery at all | `MX` for receiving not set, or endpoint not subscribed to `email.received` | Recheck Part E1/E2 and DNS propagation. |
| Reply arrives but body looks empty | HTML-only reply with no plain-text part | Expected — the app reads the plain-text body; STOP/HELP are plain words, so most replies work. |

---

## Summary checklist

- [ ] `mawqit.app` registered and **Active** in Cloudflare (A)
- [ ] `https://mawqit.app` live on Vercel with a valid cert (B)
- [ ] Sending domain **Verified** in Resend — DKIM, SPF, DMARC in DNS (C)
- [ ] `RESEND_API_KEY`, `RESEND_FROM`, `NEXT_PUBLIC_APP_URL` set in Vercel prod (D)
- [ ] Real email lands in inbox (not spam) on Gmail/Outlook/Yahoo/iCloud — **1.1 done** (D)
- [ ] Inbound receiving enabled; `MX` published (E1)
- [ ] Webhook endpoint `→ /api/inbound/email`, subscribed to `email.received` (E2)
- [ ] `RESEND_WEBHOOK_SECRET` set in Vercel prod (E3)
- [ ] `webhook_events` migration applied to prod (F)
- [ ] Real `STOP` reply disables the channel — **1.2 done** (G)
