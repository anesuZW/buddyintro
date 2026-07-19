# Performance Baseline

BuddyIntro production performance targets and measurement methodology. Update after each major release.

## Methodology

Run against a production-like VPS with PM2 cluster mode (`ecosystem.config.js`) and local media storage.

```bash
npm run build && npm start
npm run profile:production
npm run check-db-latency
npm run load:concurrency
```

## Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Cold start | < 5s | PM2 cluster ready after `pm2 reload` |
| First authenticated request | < 800ms | Home feed SSR |
| Average API latency (p50) | < 200ms | Excluding uploads |
| Average API latency (p95) | < 800ms | Excluding uploads |
| Upload throughput | Immediate ACK | Background worker completes variants |
| Database latency | < 50ms | `databaseLatencyMs` in `/api/health` |
| Memory per instance | < 512MB RSS | PM2 `max_memory_restart: 750M` |
| Standalone build size | Track trend | `.next/standalone` artifact |
| JS bundle (first load) | Track trend | Largest App Router pages |

## Largest routes to profile

- `/` home feed SSR
- `/discoveries` feed
- `/profile/[id]` profile SSR
- `POST /api/media/upload`
- `GET /api/messages`

## Health endpoints

- `GET /api/health` — load balancer probe
- `GET /api/health?verbose=1` — full subsystem diagnostics
- `GET /api/metrics` — Prometheus scrape target

## Recording results

After profiling, append a dated section:

```markdown
### 2026-07-19
- p50 API: 142ms
- p95 API: 610ms
- DB latency: 18ms
- Build artifact: 48MB tar.gz
```
