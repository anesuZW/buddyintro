# Logging — Production Standard

**Date:** 2026-07-26  
**Structured logger:** `lib/logger.ts` (Pino)

---

## Policy

| Rule | Implementation |
|------|----------------|
| Production logs | `appLogger.info/warn/error/debug` |
| Request correlation | `requestId`, `userId` via `lib/request-context.ts` |
| Log level | `LOG_LEVEL=info` (default prod) |
| Dev verbosity | `LOG_LEVEL=debug` locally only |
| No raw secrets | Never log tokens, passwords, full cookies |

---

## Changes this sprint

| File | Change |
|------|--------|
| `services/notifications/push-queue.ts` | Replaced `console.log/warn/error` with `appLogger` |

---

## Acceptable console usage (retained)

| Location | Reason |
|----------|--------|
| `middleware.ts` | JSON `console.warn` for CSRF upload rejection at Edge — structured single-line |
| `scripts/*` | CLI tools — stdout for operators |
| `lib/auth-profile.ts`, `lib/profile/*` | Gated by `PROFILE_*=1` — disabled in prod |
| `lib/simulation/*`, `lib/load-test/*` | Seed/load scripts only |
| `index.js` | Passenger boot messages |
| `app/**/error.tsx` | Client error boundary — `console.error` for browser devtools |

---

## Application services — profile-gated debug

These use `console.log` only when profiling env vars set:

- `services/discoveries.ts`
- `services/introductions.ts`
- `services/trust-recommendations.ts`

**Production:** Ensure `PROFILE_API`, `PROFILE_PHASE2`, `PROFILE_PRODUCTION`, `AUTH_PROFILE` are **unset**.

---

## Log destinations

| Process | File (PM2) |
|---------|------------|
| Web app | `shared/logs/pm2-buddyintro-*.log` |
| Media worker | `shared/logs/media-worker-*.log` |
| Push worker | `shared/logs/push-worker-*.log` |
| Job worker | `shared/logs/job-worker-*.log` |
| Nginx | `/var/log/nginx/access.log`, `error.log` |

---

## Log rotation

```bash
# /etc/logrotate.d/buddyintro
/home/buddyintro/shared/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

---

## Error visibility

| Layer | Mechanism |
|-------|-----------|
| API errors | `appLogger.error` + JSON response |
| Upload rejections | `appLogger.warn` + `X-Upload-Reject-*` headers |
| Unhandled | Next.js error boundaries + PM2 error logs |
| Health | `GET /api/health` — lite mode default |

---

## Recommended post-launch

- Ship logs to centralized store (e.g. Better Stack, Datadog) via PM2 log shipper
- Alert on `level=error` rate > threshold
- Never enable `LOG_LEVEL=debug` in production unless incident response
