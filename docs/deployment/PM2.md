# PM2 — Production Deployment

**Date:** 2026-07-26  
**Config:** `ecosystem.production.config.js` (recommended)  
**Legacy:** `ecosystem.config.js` (compatible)

---

## Architecture

```
PM2 cluster (buddyintro × N)
  └── cwd: .next/standalone
  └── script: server.js

PM2 fork workers (×3)
  └── cwd: project root
  └── media-worker, push-worker, job-worker
```

---

## Start sequence

```bash
cd /home/buddyintro/app
git pull origin main
npm ci --omit=dev
npm run build
npm run prisma:deploy

mkdir -p shared/logs shared/uploads
pm2 start ecosystem.production.config.js
pm2 save
pm2 startup   # once per server
```

---

## Production config highlights

| Setting | Value | Purpose |
|---------|-------|---------|
| `exec_mode` | `cluster` (web) | Multi-core utilization |
| `instances` | `PM2_INSTANCES` or CPU-1 | Leave core for workers |
| `max_memory_restart` | 750M (web), 512M/256M workers | OOM protection |
| `max_restarts` | 15–20 | Crash loop detection |
| `min_uptime` | 5–10s | Flapping filter |
| `merge_logs` + `time` | true | Timestamped unified logs |
| `LOG_LEVEL` | info | Structured Pino output |

---

## Cluster mode recommendation

| VPS CPUs | `PM2_INSTANCES` |
|----------|-----------------|
| 2 | 1 |
| 4 | 2–3 |
| 8 | 4–6 |

Do not exceed CPU count. Workers run as single fork each.

---

## Environment

Set via `/home/buddyintro/.env` or PM2 `env_production` block. Required vars: see `ENVIRONMENT_VARIABLES.md`.

`PROJECT_ROOT` must point to repo root (where `scripts/`, `prisma/`, `node_modules/` live).

---

## Operations

```bash
pm2 status
pm2 logs buddyintro --lines 100
pm2 reload ecosystem.production.config.js   # zero-downtime reload
pm2 restart buddyintro-media-worker
pm2 monit
```

---

## Health verification

After start:

```bash
curl -s https://buddyintro.com/api/health | jq .
npm run deploy:verify-runtime
```

---

## Passenger alternative

cPanel Passenger uses `index.js` — see `docs/deployment/PASSENGER.md`. **Recommended for InterServer:** PM2 + Nginx + standalone (this doc).

---

## Failure modes

| Symptom | Action |
|---------|--------|
| `Missing server.js` | Run `npm run build` + sync-standalone |
| Restart loop | Check `pm2 logs`, DATABASE_URL, env validation |
| Workers idle | Set `REDIS_URL` for BullMQ queues |
| Version mismatch | Run `verify-standalone-build.js` |
