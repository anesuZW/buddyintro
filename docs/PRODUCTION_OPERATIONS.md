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

**Cross-platform links:** Windows developer machines use **directory junctions** for shared paths during local deploy testing. Linux production uses **symbolic links**. Both are handled by `scripts/lib/platform-links.js` (`createSharedLink`).

## Production Database Baseline

### Background

BuddyIntro's live production database was built **before** the current Prisma Migrate folder chain (`0001_baseline` … `0009_i18n`). Schema changes were applied via older SQL folders (now archived in `prisma/migrations_archive/pre-rebuild-2026-07-14/`) and/or `prisma db push`.

The repo migration history was **rebuilt on 2026-07-14** from `schema.prisma`. Production contains all application tables and real user data, but `_prisma_migrations` is empty or only records **legacy migration names** that do not match the new folder names.

Running `npx prisma migrate deploy` against this database produces:

```
Error: P3005
The database schema is not empty.
```

Prisma refuses to apply `0001_baseline` because tables already exist. This is expected — not a corruption error.

### When to use each command

| Command | Use when | Touches data? |
|---------|----------|---------------|
| `npx prisma migrate deploy` | Normal production deploys after baseline is complete | Only runs **pending** migration SQL (additive) |
| `npx prisma migrate resolve --applied <name>` | **One-time baseline** — records a migration as applied without executing its SQL | **No** — metadata only |
| `npx prisma migrate status` | Inspect applied vs pending migrations | Read-only |
| `npm run check:migration-sync` | Pre-deploy verification against production (`DIRECT_URL`) | Read-only |
| `npx prisma migrate dev` | Local development only | **Never on production** |
| `npx prisma migrate reset` | Local empty database testing only | **DESTROYS ALL DATA** |

### What must NEVER be done in production

- `prisma migrate reset`
- Dropping the database or application tables
- Deleting rows from `_prisma_migrations` manually
- Editing `_prisma_migrations` by hand
- `prisma db push --accept-data-loss`
- Re-running baseline `resolve` for migrations already marked applied

### Pre-baseline verification (read-only)

**1. Backup (mandatory)**

```bash
pg_dump "$DIRECT_URL" -Fc -f "buddyintro-pre-baseline-$(date +%F).dump"
```

**2. SQL sanity check**

```bash
psql "$DIRECT_URL" -f scripts/sql/verify-migration-baseline.sql
```

Expected before baseline:

- All eight `has_*` markers through `has_media_platform` = `t`
- `has_preferred_language_column` = `f` (0009 not yet applied)
- `_prisma_migrations` empty or missing entries for `0001_baseline` … `0008_media_platform`

**3. Automated check**

```bash
export DIRECT_URL="postgresql://..."   # direct connection, port 5432 — not pooler
npm run check:migration-sync
```

This confirms schema markers exist and prints the exact `migrate resolve` commands if baseline is required.

**4. Schema diff (optional but recommended)**

```bash
npx prisma migrate diff \
  --from-url "$DIRECT_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

Safe if output is **empty** or contains **only** the `0009_i18n` changes (`preferred_language` column). Any other diff means the live schema does not match migrations `0001`–`0008` — stop and investigate before baselining.

### One-time baseline procedure (production)

Run on the production host (or any machine with `DIRECT_URL` pointing at production). Use the **direct** Postgres URL (`DIRECT_URL`), not the PgBouncer pooler.

```bash
cd /path/to/buddyintro/current
export DIRECT_URL="postgresql://..."   # from shared/.env

# Step 1 — Record migrations 0001–0008 as already applied (NO SQL executed)
npx prisma migrate resolve --applied 0001_baseline
npx prisma migrate resolve --applied 0002_discoveries
npx prisma migrate resolve --applied 0003_trust_graph
npx prisma migrate resolve --applied 0004_notifications
npx prisma migrate resolve --applied 0005_moderation
npx prisma migrate resolve --applied 0006_platform
npx prisma migrate resolve --applied 0007_security_rbac
npx prisma migrate resolve --applied 0008_media_platform

# Step 2 — Apply the only pending migration
npx prisma migrate deploy

# Step 3 — Verify
npx prisma migrate status
npm run check:migration-sync
```

**Why `migrate resolve --applied` is safe:** It inserts a row into `_prisma_migrations` marking the migration as finished. It does **not** execute `migration.sql`, drop tables, or modify user rows. You only run it after confirming the schema markers above already exist.

**Why `migrate deploy` is safe after baseline:** Prisma skips resolved migrations and runs only `0009_i18n`:

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_language" TEXT NOT NULL DEFAULT 'en';
CREATE INDEX IF NOT EXISTS "users_preferred_language_idx" ON "users"("preferred_language");
```

This is additive, uses `IF NOT EXISTS`, defaults existing users to `'en'`, and preserves all data.

### After baseline — normal deploy workflow

Once baseline completes:

```bash
npx prisma migrate deploy    # applies any new migrations (0010+, etc.)
npx prisma migrate status    # must show "Database schema is up to date"
```

Future migrations execute normally because `_prisma_migrations` tracks the canonical folder names.

### Pre-deploy verification (CI / release machine)

```bash
npm run deploy:verify
```

When `DIRECT_URL` is set, this also runs `npm run check:migration-sync` and fails if:

- Baseline migrations are not recorded in `_prisma_migrations`
- Schema markers for `0001`–`0008` are missing
- Unexpected pending migrations exist

On the production server before deploy:

```bash
export DIRECT_URL="$(grep ^DIRECT_URL= shared/.env | cut -d= -f2-)"
npm run check:migration-sync
```

### Recovery scenarios

| Situation | Action |
|-----------|--------|
| P3005 on first deploy after rebuild | Run one-time baseline (`resolve` × 8, then `deploy`) |
| `0009_i18n` fails but column already exists | `npx prisma migrate resolve --applied 0009_i18n` then verify status |
| `migrate deploy` wants to re-apply old migration | Do **not** reset — check `_prisma_migrations`; use `resolve --applied` only for migrations whose schema already exists |
| Schema drift detected in diff | Fix schema manually or add a forward migration — **never** reset production |

### PM2 / CloudLinux / Blue-Green

All deploy paths call `npx prisma migrate deploy`. Complete the **one-time baseline** before the next production deploy. After that, deploy scripts apply new migrations automatically.

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
| P3005 migrate deploy | See [Production Database Baseline](#production-database-baseline) |

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
