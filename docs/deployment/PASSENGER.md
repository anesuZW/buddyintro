# InterServer Passenger Deployment Guide

BuddyIntro runs on **InterServer cPanel** using **Phusion Passenger** and Node.js 18/20 LTS.

## Prerequisites

- cPanel with Setup Node.js App
- SSH access
- Supabase project (PostgreSQL + Auth + Storage)
- Domain pointed to hosting

## 1. Build release package (local or CI)

```bash
npm run release -- --no-bump
# or after version bump:
npm run release -- --patch
```

Output: `deployment/releases/BuddyIntro-vX.Y.Z.zip`

## 2. Upload to server

Upload ZIP via SFTP or cPanel File Manager to `~/releases/`.

```bash
ssh user@your-server
mkdir -p ~/buddyintro
cd ~/buddyintro
unzip ~/releases/BuddyIntro-v0.1.0.zip
```

## 3. Install production dependencies

```bash
cd ~/buddyintro
npm ci --omit=dev
npx prisma generate
```

## 4. Environment variables

cPanel → **Setup Node.js App** → Environment variables.

Copy from `.env.example`. Required:

| Variable | Purpose |
| -------- | ------- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Pooled Supabase URL (`connection_limit=5`) |
| `DIRECT_URL` | Direct Postgres for migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin |
| `NEXT_PUBLIC_APP_URL` | `https://buddyintro.com` |
| `ADMIN_EMAILS` | Comma-separated admin emails |
| `RESEND_API_KEY` | Email (recommended) |
| `EMAIL_FROM` | `BuddyIntro <notifications@buddyintro.com>` |

**Never set in production:** `PROFILE_PRODUCTION`, `AUTH_PROFILE`, `HEALTH_MONITORING`

## 5. Database migrations

```bash
npx prisma migrate deploy
npm run db:rls   # first deploy only — applies RLS policies
```

## 6. Passenger configuration

| Setting | Value |
| ------- | ----- |
| Application root | `/home/user/buddyintro` |
| Application startup file | `index.js` |
| Node.js version | 18.x or 20.x |
| Application mode | Production |

Passenger sets `PORT` automatically — do not hardcode.

## 7. Restart Passenger

```bash
cd ~/buddyintro
mkdir -p tmp
touch tmp/restart.txt
```

Or cPanel → Setup Node.js App → **Restart**.

## 8. Health verification

```bash
curl -sf https://buddyintro.com/api/health | jq .
```

Expected:

```json
{ "status": "healthy", "database": "healthy", "supabase": "healthy" }
```

From local machine with env loaded:

```bash
npm run health -- --url=https://buddyintro.com
```

## 9. Background jobs (optional)

Run job worker via cron or second Node app:

```bash
npm run job-worker
```

## Rollback

```bash
npm run rollback -- --list    # list available tags
npm run rollback -- --tag=v0.1.0
```

Or use automatic rollback (triggered when `npm run deploy` fails after git sync).

If migrations were applied forward, use **Supabase PITR** before redeploying old code. See `docs/BACKUP_RECOVERY_PLAN.md`.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| 503 on all routes | Check `index.js` logs; ensure `.next/` exists |
| Prisma errors | Run `npx prisma generate` after deploy |
| Auth loops | Verify `NEXT_PUBLIC_APP_URL` matches domain |
| Slow responses | Colocate hosting with Supabase region |

## 9. Automated deploy (recommended)

From your local machine (SSH key required):

```bash
# Pre-flight checks
npm run doctor

# Full pipeline
npm run release -- --patch
npm run publish
npm run deploy
```

`npm run deploy` uses **GitHub `origin/main` as source of truth**:

```
git fetch origin
git reset --hard origin/main
git clean -fd
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
touch tmp/restart.txt
```

Then polls `/api/health` every 5 seconds (max 120s).

**Safety:**
- SSH public-key auth only (no passwords)
- Never overwrites server `.env`
- Never runs `prisma db push`
- Automatic rollback to previous tag if deploy fails after git sync
- Logs written to `deployment/logs/deploy-*.log`

Configure `DEPLOY_*` vars in `.env.local` (see `.env.example`).

## 10. Rollback

**Automatic:** Triggered by `npm run deploy` if health check fails after git sync.

**Manual:**

```bash
npm run rollback
# Select a previous git tag interactively
```

Or: `npm run rollback -- --tag=v0.1.0`

If migrations were applied forward, use **Supabase PITR** before redeploying old code. See `docs/BACKUP_RECOVERY_PLAN.md`.

## File updates (subsequent releases)

1. Upload new ZIP
2. Extract over app directory (keep `.env` on server)
3. `npm ci --omit=dev`
4. `npx prisma migrate deploy`
5. `touch tmp/restart.txt`
6. Health check
