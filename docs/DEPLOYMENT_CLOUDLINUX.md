# BuddyIntro CloudLinux Deployment (v6)

Atomic app-root deployment for **InterServer CloudLinux Node.js Manager + Passenger**.

**Build philosophy:** `next build` always runs on your **local development machine**. The server never executes `next build`. Packages are extracted into `staging/`, validated and activated there, then atomically synced to the live app root.

---

## Server layout

```
/home/socialit/repositories/buddyintro.com/   ← DEPLOY_APP_PATH (Passenger root)
  .env                                        ← preserved (never overwritten)
  index.js, server.js, .next/, node_modules/  ← live application
  incoming/                                   ← uploaded tar.gz packages
  staging/                                    ← extract + validate + activate (ephemeral)
  backups/                                    ← immutable .tar.gz archives
    2026-07-17-0930.tar.gz
  tmp/
    restart.txt                               ← Passenger restart trigger
    deploy.lock                               ← concurrent deploy guard
  public/uploads/                             ← preserved
  storage/                                    ← preserved
```

**No** `releases/`, **no** `current` symlink, **no** recursive rsync backups.

---

## v6 deployment flow

```
npm run deploy
  ├─ Git integrity gate (local)
  ├─ npm run build (local, standalone output)
  ├─ Package standalone → deployment/packages/YYYY-MM-DD-HHMM.tar.gz
  ├─ SCP upload → incoming/
  └─ SSH remote steps
       ├─ Acquire tmp/deploy.lock (abort if locked)
       ├─ Extract package → staging/
       ├─ Validate staging (server.js, .next/BUILD_ID, .next/static, public, …)
       ├─ Activate in staging (npm install --omit=dev if needed, prisma generate, migrate)
       ├─ Smoke-test staging
       ├─ Create tar.gz backup of live app → backups/<id>.tar.gz
       ├─ Atomic rsync staging → app (delay-updates; rsync 23/24 = warnings only)
       ├─ Restart Passenger (touch tmp/restart.txt, sleep 5, cloudlinux-selector, sleep 10)
       ├─ Poll /api/health + /api/version (120s version timeout; 404 tolerated during warm-up)
       └─ Release deploy lock
```

On failure after backup: **automatic restore** from `backups/<id>.tar.gz`.

---

## Why v6 (fixes v5 failures)

| v5 problem | v6 fix |
|------------|--------|
| rsync backup into `app/backups/id/` while app is live | Immutable `tar.gz` backup with excludes |
| Recursive `backups/` traversal | Backup path is outside rsync source tree |
| rsync exit 24 (vanished files) treated as fatal | Exit codes 23/24 are warnings only |
| Extract directly into live app | Staging directory + atomic sync |
| Concurrent deploys | `tmp/deploy.lock` |

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run deploy` | Full pipeline: local build → package → atomic deploy |
| `npm run deploy:build` | Local build + package only |
| `npm run deploy:upload` | Upload + deploy latest package |
| `npm run deploy:rollback -- --backup=2026-07-17-0930` | Restore `.tar.gz` backup |
| `npm run deploy:clean -- --keep=5` | Prune old backup archives |

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DEPLOY_APP_PATH` | Passenger application root |
| `DEPLOY_SSH_*` | SSH access |
| `DEPLOY_HEALTH_URL` | Health check URL |
| `DEPLOY_VERSION_MAX_MS` | Version poll timeout (default **120000**) |
| `DEPLOY_SKIP_MIGRATIONS=1` | Skip `prisma migrate deploy` on server |
| `DEPLOY_KEEP_BACKUPS` | Backups to retain (default 5) |
| `DEPLOY_NODE_BIN` | CloudLinux Node path |

---

## Rollback

Automatic: failed deploy restores `backups/<deploy-id>.tar.gz`.

Manual:

```bash
npm run deploy:rollback -- --backup=2026-07-17-0930
```

Legacy v5 directory backups (`backups/<id>/`) are still supported for one-time restore.

---

## Deployment history

Successful and rollback deploys are recorded in `deployment/history.json` with:

- `deployId`, `timestamp`, `sha`, `runtimeSha`, `version`
- `backupArchive`, `buildId`, `duration`, `health`, `rollback`, `deployMode`
