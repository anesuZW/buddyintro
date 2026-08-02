# Production Monitoring

**Date:** 2026-07-26  
**Target:** InterServer VPS + Cloudflare

---

## Health endpoint

| URL | Mode | Use |
|-----|------|-----|
| `GET /api/health` | Lite (default) | Load balancer / uptime — `SELECT 1` |
| `GET /api/health?verbose=1` | Full | Ops dashboard |
| `GET /api/health?deep=1` | Deep | Incident investigation |
| `GET /api/version` | Build metadata | Deploy verification |

Poll interval: **30–60s** from external monitor.

---

## PM2 monitoring

```bash
pm2 monit                    # Interactive CPU/memory
pm2 status                   # Process table
pm2 logs --err --lines 200   # Recent errors
```

Enable PM2 Plus (optional) for web dashboard — not required at launch.

---

## Log rotation

See `LOGGING.md` — logrotate on `shared/logs/*.log`, 14-day retention.

---

## Error tracking (recommended)

| Tool | Integration |
|------|-------------|
| Sentry | Next.js SDK — post-launch quick win |
| Better Stack | PM2 log drain |
| Supabase dashboard | DB errors, connection count |

Not configured in repo — add post-launch without code changes to core flows.

---

## Uptime monitoring

External probes (UptimeRobot, Better Uptime, Cloudflare health checks):

1. `GET https://buddyintro.com/api/health` — expect 200, < 5s
2. `GET https://buddyintro.com/` — expect 200 or 307 to login
3. Alert on 2 consecutive failures

---

## Infrastructure metrics

| Metric | Tool | Alert |
|--------|------|-------|
| CPU | `htop`, VPS panel | > 85% sustained 10m |
| Memory | PM2 monit | Near `max_memory_restart` |
| Disk | `df -h` | > 85% on `/` or uploads volume |
| Nginx 5xx | access log | > 1% of requests |
| SSL expiry | certbot timer | < 14 days |

---

## Application metrics

| Endpoint | Purpose |
|----------|---------|
| `GET /api/metrics` | Internal metrics (protect in prod — firewall or auth) |

Runtime DB latency logged when profiling enabled only.

---

## Realtime / workers

| Worker | Health signal |
|--------|---------------|
| `buddyintro-media-worker` | PM2 online; media jobs completing |
| `buddyintro-push-worker` | Requires `REDIS_URL`; push delivery |
| `buddyintro-job-worker` | Background jobs table not backing up |

Check `GET /api/health?verbose=1` for worker status summary.

---

## Post-deploy verification

```bash
npm run deploy:verify-runtime
npm run production:health
node scripts/verify-deployment.js
```

---

## Incident response (first 15 minutes)

1. Check `pm2 status` + `pm2 logs --err`
2. Check `GET /api/health?verbose=1`
3. Check Supabase status + connection pool usage
4. Check Nginx error log
5. Rollback if deploy-related — see `ROLLBACK.md`

---

## Launch week watch list

| Signal | Owner |
|--------|-------|
| Health p95 latency | SRE |
| 5xx rate | SRE |
| Story publish failures (400 pooler) | Backend |
| Email delivery bounces | Product ops |
| PM2 restart count | DevOps |
