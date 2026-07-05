# Email Deliverability Report

Generated: 2026-06-23

---

## Current configuration

| Setting | Source | Default / example |
| ------- | ------ | ----------------- |
| Primary provider | `services/email.ts` | Resend (`RESEND_API_KEY`) |
| Fallback | Same file | SMTP (`SMTP_HOST`, `SMTP_PORT`) |
| From address | `lib/branding.ts` → `BRAND_EMAIL_FROM` | `EMAIL_FROM` or `RESEND_FROM` or `BuddyIntro <invites@buddyintro.com>` |
| Support | `BRAND_SUPPORT_EMAIL` | `LEGAL_SUPPORT_EMAIL` or `support@buddyintro.com` |

---

## Resend audit

| Check | Status | Notes |
| ----- | ------ | ----- |
| API key required for send | OK | Returns `{ ok: false }` if unset — logs warning, no crash |
| From uses verified domain | **Action required** | Must verify `buddyintro.com` (or your domain) in Resend dashboard |
| Gmail as `from` | **Not in code defaults** | `.env.example` uses `invites@yourdomain.com` |
| Admin email is Gmail | Info only | `ADMIN_EMAILS=anesugozo@gmail.com` in `.env.example` — **recipient/admin**, not sender |
| Display name | OK | `BuddyIntro <email@domain>` format via `BRAND_EMAIL_FROM` |

---

## Invalid sender risks

| Pattern | Risk | Found in repo? |
| ------- | ---- | -------------- |
| `from: user@gmail.com` via Resend | **Hard fail** — Resend rejects unverified Gmail | No hardcoded Gmail sender |
| `from: @gmail.com` in env | Would fail in production if set | Not in committed `.env`; audit local `.env.local` |
| Missing `RESEND_API_KEY` | Silent skip — invites/notifications not emailed | Dev OK; **prod blocker** if email is required |

---

## Production-safe sender setup

1. **Verify domain** in [Resend Domains](https://resend.com/domains) — add DNS records (SPF, DKIM, optional DMARC).
2. **Set env** (production):

   ```env
   RESEND_API_KEY=re_live_...
   EMAIL_FROM="BuddyIntro <invites@buddyintro.com>"
   LEGAL_SUPPORT_EMAIL=support@buddyintro.com
   ```

3. **Do not use** `@gmail.com`, `@yahoo.com`, or personal addresses as `from`.
4. **Separate transactional subdomains** (optional): `invites@`, `notifications@`, `support@` — all on verified domain.
5. **Test** before launch:

   ```bash
   # After deploy, trigger invite or notification in staging
   ```

6. **Monitor** Resend dashboard for bounces/complaints in first 100 users.

---

## Code paths that send email

| Path | Template |
| ---- | -------- |
| Invites | `services/email-templates/invitation-story.ts` |
| Notification email | `services/notifications/notification-email.ts` |
| Generic | `services/email.ts` → `sendEmail()` |

All use `getFromAddress()` → `BRAND_EMAIL_FROM`.

---

## Launch impact (first 100 users)

| Issue | Impact |
| ----- | ------ |
| Missing `RESEND_API_KEY` in prod | Users get no invite/notification emails — **configure before launch if email is core** |
| Unverified domain | Resend API errors — **verify domain before launch** |
| Gmail sender in local env | Would break email if copied to prod — **audit `.env.local`** |

**Not a code blocker** if Resend + verified domain configured in deployment env.
