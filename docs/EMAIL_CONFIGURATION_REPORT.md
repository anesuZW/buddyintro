# Email Configuration Report

Generated: 2026-06-23

## Auto-configuration behavior

When environment variables are set:

```env
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM="BuddyIntro <notifications@buddyintro.com>"
```

The system automatically:

1. Sends via **Resend** using `EMAIL_FROM` (or `RESEND_FROM`)
2. Falls back to **SMTP** if Resend fails (`SMTP_HOST`, `SMTP_PORT`, etc.)
3. Falls back to **logging** if no provider configured — **never crashes**

## Implementation

| File | Behavior |
| ---- | -------- |
| `lib/branding.ts` | `BRAND_EMAIL_FROM` prefers `EMAIL_FROM`; defaults to `notifications@buddyintro.com` when `RESEND_API_KEY` set |
| `services/email.ts` | Resend → SMTP → warn + `{ ok: false }`; all paths wrapped in try/catch |

Default when only `RESEND_API_KEY` is set (no `EMAIL_FROM`):

```
BuddyIntro <notifications@buddyintro.com>
```

## Resend verification

Assumption: `notifications@buddyintro.com` is being verified in Resend dashboard.

Until verified, sends may fail with domain errors — application continues via SMTP fallback or log-only mode.

## Pre-launch checklist

- [ ] Set `RESEND_API_KEY` in production env
- [ ] Set `EMAIL_FROM="BuddyIntro <notifications@buddyintro.com>"`
- [ ] Confirm domain DNS (SPF, DKIM) in Resend
- [ ] Send test invite from staging
- [ ] Monitor `[email] Resend failed` in logs

## Status

**PASS (configuration)** — Code supports env-driven Resend with graceful degradation.  
**ACTION REQUIRED (ops)** — Verify domain in Resend before relying on email delivery.
