# Environment Variables — Production Reference

**Date:** 2026-07-26  
**Validation:** `lib/diagnostics/env-validation.ts`, `scripts/startup-check.ts`, `npm run doctor`

Legend: **R** = Required in production, **O** = Optional, **S** = Secret (never commit), **P** = Public (client bundle safe)

---

## Core application

| Variable | R/O | Default | Purpose | Sensitivity |
|----------|-----|---------|---------|-------------|
| `NODE_ENV` | R | `development` | Runtime mode | Low |
| `NEXT_PUBLIC_APP_URL` | R | — | Canonical site URL (links, emails, CSRF) | P |
| `PORT` | O | `3000` | HTTP listen port (PM2/Nginx upstream) | Low |
| `PROJECT_ROOT` | O | repo root | PM2 workers + standalone paths | Low |
| `LOG_LEVEL` | O | `info` (prod) | Pino log level: debug/info/warn/error | Low |
| `ALLOWED_ORIGINS` | O | `NEXT_PUBLIC_APP_URL` | CSRF origin allowlist (comma-separated) | Low |

---

## Supabase / Auth

| Variable | R/O | Purpose | Sensitivity |
|----------|-----|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | R | Supabase project URL | P |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | R | Browser + SSR anon key | P (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | R | Admin ops, seed, server bypass | **S** |
| `SUPABASE_JWT_SECRET` | O | JWT verification if used | **S** |

---

## Database (Prisma)

| Variable | R/O | Purpose | Sensitivity |
|----------|-----|---------|-------------|
| `DATABASE_URL` | R | Runtime queries (Supabase pooler, port 6543) | **S** |
| `DIRECT_URL` | R | Migrations + long transactions (direct port 5432) | **S** |

**Production rule:** Use pooler for app traffic; use `DIRECT_URL` for `prisma migrate deploy` only.

---

## Media storage

| Variable | R/O | Default | Purpose | Sensitivity |
|----------|-----|---------|---------|-------------|
| `MEDIA_PROVIDER` | R | `local` | `local`, `s3`, `supabase`, etc. | Low |
| `NEXT_PUBLIC_MEDIA_PROVIDER` | O | mirrors server | Client display hint | P |
| `MEDIA_ROOT` | R (local) | `./uploads` | Local upload directory on VPS | Low |
| `MEDIA_WEBP_QUALITY` | O | `82` | Image optimization quality | Low |
| `CDN_URL` | O | — | Public CDN base for media | P |

### S3-compatible (when `MEDIA_PROVIDER=s3`)

| Variable | Sensitivity |
|----------|-------------|
| `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION` | Low |
| `MEDIA_S3_ACCESS_KEY_ID`, `MEDIA_S3_SECRET_ACCESS_KEY` | **S** |
| `MEDIA_S3_PUBLIC_BASE_URL` | P |

### Backblaze B2 / Cloudflare R2 (optional backup)

| Variable | Purpose |
|----------|---------|
| `MEDIA_BACKUP_PROVIDER` | `none`, `backblaze`, `r2` |
| `MEDIA_B2_*`, `MEDIA_R2_*` | Backup credentials — **S** |

---

## Email

| Variable | R/O | Purpose | Sensitivity |
|----------|-----|---------|-------------|
| `RESEND_API_KEY` | O* | Primary transactional email | **S** |
| `EMAIL_FROM` / `RESEND_FROM` | O | From header | Low |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | O | SMTP fallback | Low |
| `SMTP_USER`, `SMTP_PASS` | O | SMTP auth | **S** |

\* At least one of Resend or SMTP required for invitation emails.

---

## Web Push (PWA)

| Variable | R/O | Purpose | Sensitivity |
|----------|-----|---------|-------------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | O | Browser push subscription | P |
| `VAPID_PRIVATE_KEY` | O | Push signing | **S** |
| `VAPID_SUBJECT` | O | `mailto:support@…` | Low |

---

## Redis / workers

| Variable | R/O | Purpose | Sensitivity |
|----------|-----|---------|-------------|
| `REDIS_URL` | O | BullMQ media/push queues | **S** |
| `PM2_INSTANCES` | O | Cluster size (default CPU-1) | Low |
| `MEDIA_WORKER_CONCURRENCY` | O | Media worker parallelism | Low |
| `PUSH_WORKER_CONCURRENCY` | O | Push worker parallelism | Low |
| `JOB_WORKER_INTERVAL_MS` | O | Background job poll interval | Low |

---

## Phone verification (Twilio)

| Variable | R/O | Purpose | Sensitivity |
|----------|-----|---------|-------------|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | O | SMS verification | **S** |
| `PHONE_VERIFICATION_BETA_CODE` | O | Local dev bypass | Low (dev only) |

---

## Admin & legal

| Variable | Purpose | Sensitivity |
|----------|---------|-------------|
| `ADMIN_EMAILS` | Comma-separated admin access | Low |
| `LEGAL_ENTITY_NAME`, `LEGAL_ENTITY_ADDRESS` | Privacy/terms pages | Low |
| `LEGAL_SUPPORT_EMAIL` | Support contact | Low |
| `LEGAL_PRIVACY_VERSION`, `LEGAL_TERMS_VERSION`, `LEGAL_COOKIES_VERSION` | Consent versioning | Low |

---

## Deployment (CI / SSH)

| Variable | Purpose | Sensitivity |
|----------|---------|-------------|
| `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_SSH_PORT` | Remote deploy | **S** |
| `DEPLOY_APP_PATH` | VPS app root | Low |
| `DEPLOY_GIT_BRANCH`, `DEPLOY_GIT_REPO_URL`, `DEPLOY_COMMIT_SHA` | Release pinning | Low |
| `DEPLOY_HEALTH_URL` | Post-deploy probe | Low |
| `DEPLOY_SKIP_MIGRATIONS` | Emergency skip (default run migrations) | Low |
| `DEPLOY_KEEP_BACKUPS` | Release retention | Low |
| `BACKUP_ROOT` | Nightly backup directory | Low |

---

## Profiling (disable in production)

| Variable | Purpose |
|----------|---------|
| `PROFILE_API`, `PROFILE_PHASE2`, `PROFILE_PRODUCTION`, `AUTH_PROFILE` | Dev/staging profiling only — **unset in prod** |

---

## Cloudflare

Cloudflare is configured at DNS/WAF layer (not env vars in app). Ensure:

- SSL mode: **Full (strict)**
- Origin cert or Let's Encrypt on VPS
- `NEXT_PUBLIC_APP_URL` matches public hostname

---

## Development vs production checklist

| Check | Development | Production |
|-------|-------------|------------|
| `DATABASE_URL` | Supabase pooler OK | Supabase pooler OK |
| `DIRECT_URL` | Direct or pooler | **Direct host for migrations** |
| `MEDIA_ROOT` | `./uploads` | `/home/buddyintro/shared/uploads` |
| `RESEND_API_KEY` | Optional (422 on example.com) | **Required** with verified domain |
| `REDIS_URL` | Optional | **Recommended** for media/push workers |
| Profiling env vars | May be set | **Must be unset** |

---

## Secret leakage audit

Client bundle (`NEXT_PUBLIC_*` only):

- Supabase URL + anon key ✅
- VAPID public key ✅
- App URL ✅

Never in client: `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, SMTP/Twilio/S3 credentials.

Run before deploy: `grep -r "SERVICE_ROLE\|RESEND_API\|SMTP_PASS" app components lib --include="*.tsx"` — must not appear outside server modules.
