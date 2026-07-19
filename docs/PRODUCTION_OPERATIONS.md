# Production Operations

Operational guide for BuddyIntro at scale.

## Architecture overview

| Component | Technology |
|-----------|------------|
| App | Next.js 14 standalone |
| Process manager | PM2 cluster (`ecosystem.config.js`) |
| Reverse proxy | Nginx |
| Database | PostgreSQL (Supabase) |
| Queue | BullMQ + Redis (optional Prisma fallback) |
| Media | Local disk or S3-compatible providers |
| Auth | Supabase Auth |

## Deployment environments

BuddyIntro separates **development** and **production** configuration.

| Environment | Typical host | Purpose |
|-------------|--------------|---------|
| Development | Windows, macOS, Linux dev machine | Coding, testing, building release packages |
| Production | Ubuntu VPS | Running BuddyIntro under PM2 |

**Development**

```bash
cp .env.development.example .env
npm run startup-check   # auto-creates ./uploads when missing
npm run dev
```

**Production**

```bash
mkdir -p /home/buddyintro/shared/uploads
cp .env.production.example .env
npm run startup-check   # fails with mkdir guidance if storage is missing
```

Development resolves `MEDIA_ROOT=./uploads` to an absolute project path (for example `C:\dev\friendintro\uploads` on Windows). Production requires an absolute `MEDIA_ROOT` and never auto-creates media storage.

Windows development machines prepare releases; the Ubuntu VPS runs production.

## Deployment

### CloudLinux / Passenger (existing)

```bash
npm run deploy          # v6 atomic deploy
npm run deploy:verify   # pre-flight checks
npm run deploy:rollback
```

See [DEPLOYMENT_CLOUDLINUX.md](./DEPLOYMENT_CLOUDLINUX.md).

### Ubuntu VPS — Blue/Green (PM2)

Layout on server:

```
/home/buddyintro/
  releases/20260719-001/
  current -> releases/20260719-001/
  shared/uploads/
  shared/.env
  shared/logs/
```

Deploy:

```bash
npm run deploy:v3
```

Flow: git archive → `npm ci` → `prisma migrate deploy` → build → smoke test → symlink switch → `pm2 reload` → health check → auto rollback on failure.

**Cross-platform links:** Windows developer machines use **directory junctions** for shared paths during local deploy testing. Linux production uses **symbolic links**. Both are handled by `scripts/lib/platform-links.js` (`createSharedLink`).

### PM2

```bash
cd current
pm2 start ecosystem.config.js
pm2 reload ecosystem.config.js --update-env
pm2 status
pm2 logs buddyintro
```

Instances default to `CPU_COUNT - 1`. Override with `PM2_INSTANCES`.

## Rollback

```bash
npm run deploy:rollback          # CloudLinux tar backup
node scripts/restore.js --release 20260719-001
```

## Monitoring

| Endpoint | Purpose |
|----------|---------|
| `/api/health` | Load balancer probe |
| `/api/health?verbose=1` | Full diagnostics |
| `/api/metrics` | Prometheus scrape |
| `/maindash/system` | Admin dashboard |

Configure nginx to protect `/api/metrics` and `/maindash/*`.

## Logging

Structured logs via **pino** (`lib/logger.ts`).

Every log includes: timestamp, level, requestId, userId, route, durationMs.

```bash
LOG_LEVEL=info LOG_JSON=1 pm2 logs buddyintro
```

Request IDs are returned in the `x-request-id` response header.

## Workers

```bash
pm2 start ecosystem.config.js   # includes media + job workers
npm run media-worker            # standalone media worker
npm run job-worker              # general Prisma queue
npm run media:cleanup           # orphan cleanup (schedule nightly)
```

Worker dashboard: `GET /api/admin/worker`

## Backups

Nightly (schedule via cron):

```bash
npm run backup:nightly
npm run media:backup
```

Retention: daily ×14, weekly ×8, monthly ×12.

Restore:

```bash
node scripts/restore.js --backup ./backups/nightly/2026-07-19 --database --uploads --env
```

## Redis

When `REDIS_URL` is set:

- BullMQ media queue
- Distributed rate limiting
- Response cache (`lib/cache.ts`)

Without Redis, all features fall back to in-process equivalents.

## Media & CDN

See [MEDIA_ARCHITECTURE.md](./MEDIA_ARCHITECTURE.md).

Set `CDN_URL` for S3/B2/R2 public URLs.

## Health checks

Production summary includes:

- Database + Redis latency
- Queue depth
- Storage + disk usage
- Memory + uptime
- Build version + git commit
- Worker heartbeat

## Security

- Security headers in `middleware.ts` and `next.config.js`
- Origin validation for mutating requests
- Redis-backed rate limits when available
- Admin routes require RBAC

## Troubleshooting

| Symptom | Check |
|---------|-------|
| 503 after deploy | `/api/health?verbose=1`, PM2 logs |
| Slow uploads | Media worker running? Redis connected? |
| High queue depth | `/api/admin/worker`, dead letter queue |
| Disk full | `/api/health` disk metrics, `media:cleanup` |
| Rollback needed | `deploy:rollback` or `restore.js --release` |

## SSL / Nginx

Terminate TLS at nginx. Proxy to PM2 on `127.0.0.1:3000`. Cache `/uploads/` and immutable assets at the edge.

## Scaling

1. Increase `PM2_INSTANCES`
2. Add Redis for shared queue + cache
3. Move media to CDN-backed object storage
4. Use Supabase connection pooler (`DATABASE_URL` with pgbouncer)

## Environment validation

Production refuses to start if critical env vars are missing (`lib/env-validation.ts`) or if `MEDIA_ROOT` is not an absolute path. Run startup diagnostics manually:

```bash
npm run startup-check
```

Templates: `.env.development.example` (local dev, `MEDIA_ROOT=./uploads`) and `.env.production.example` (VPS, absolute `MEDIA_ROOT`).

Required: `DATABASE_URL`, Supabase keys, `MEDIA_PROVIDER`, `NEXT_PUBLIC_APP_URL`, `MEDIA_ROOT` (local provider).
