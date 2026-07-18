# BuddyIntro Standalone Deployment Architecture (v4)

**Local build → package → upload → release activation**

Next.js is **never** built on the production server. This avoids CloudLinux LVE limits that block SWC worker processes during `next build`.

---

## Deployment flow

```
Developer machine                    Production server (DEPLOY_APP_PATH)
─────────────────                    ───────────────────────────────────
npm run deploy
  │
  ├─ Git integrity gate (local)
  ├─ npm install (local)
  ├─ npm run build (local, standalone)
  ├─ Package → deployment/packages/RELEASE_ID.tar.gz
  ├─ SCP upload → packages-incoming/
  │
  └─ SSH remote steps ─────────────► mkdir releases/RELEASE_ID
                                       tar -xzf packages-incoming/*.tar.gz
                                       ln -sfn $DEPLOY_APP_PATH/.env .env
                                       node node_modules/prisma/... migrate deploy
                                       ln -sfn releases/ID current
                                       touch current/tmp/restart.txt
                                       health + version verification
```

---

## Server directory layout

```
~/buddyintro.com/                    ← DEPLOY_APP_PATH
  .env                               ← shared across all releases
  releases/
    20260715-142233/                 ← timestamped release
      server.js
      index.js                       ← Passenger entry
      .next/
      public/
      prisma/
      deployment/build.json
      deployment/manifest.json
    20260715-155012/
  current → releases/20260715-155012/  ← active release symlink
  packages-incoming/                   ← upload staging (cleared after extract)
  .previous-successful-release       ← rollback marker
  .previous-successful-sha           ← commit SHA for version checks
```

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run deploy` | Full pipeline: local build → package → upload → activate → verify |
| `npm run deploy:build` | Local build + package only (`deployment/packages/latest.json`) |
| `npm run deploy:upload` | Upload + activate latest local package |
| `npm run deploy:rollback` | Switch `current` symlink to previous release |
| `npm run deploy:clean` | Remove old server releases (keep last 5) |
| `npm run rollback` | Alias for `deploy:rollback` |

### Options

```bash
npm run deploy:build -- --skip-install
npm run deploy:build -- --release=20260715-120000
npm run deploy:rollback -- --release=20260715-142233
npm run deploy:rollback -- --list
npm run deploy:clean -- --keep=5
```

---

## Rollback flow

1. Read `.previous-successful-release` from server
2. `ln -sfn releases/PREVIOUS current`
3. `touch current/tmp/restart.txt`
4. Poll `/api/health` and `/api/version`
5. **No server-side build** — previous release artifacts are already on disk

Automatic rollback runs if health/version checks fail after a new release is activated.

---

## Release management

- Each deploy creates a new timestamped folder under `releases/`
- `current` symlink atomically switches to the new release
- Old releases are kept (default: last 5) for instant rollback
- `npm run deploy:clean` removes older releases on the server

---

## Deployment metadata

Each package includes:

| File | Purpose |
|------|---------|
| `deployment/build.json` | Full build metadata |
| `deployment/manifest.json` | Release manifest (ID, SHA, versions) |
| `build/version.json` | Legacy format for `/api/version` |

Exposed via:
- `GET /api/version` — commit, branch, deploymentId, versions
- `GET /api/health` — includes `deployment` block with version/commit/deploymentId

Example `deployment/build.json`:

```json
{
  "version": "0.1.3",
  "gitCommit": "3006b5d630008572bafdcc21e56efe3779c1ce4c",
  "gitBranch": "main",
  "buildDate": "2026-07-15T12:00:00.000Z",
  "nodeVersion": "v20.20.2",
  "nextVersion": "14.2.15",
  "prismaVersion": "5.22.0",
  "deploymentId": "20260715-120000"
}
```

---

## Logging

Deploy logs (`deployment/logs/deploy-*.log`) include timed phases:

- `TIMING_LOCAL_BUILD`
- `TIMING_PACKAGE`
- `TIMING_UPLOAD`
- `TIMING_EXTRACT`
- `TIMING_DEPS_INSTALL`
- `TIMING_PRISMA_GENERATE`
- `TIMING_PRISMA_MIGRATE`
- `TIMING_ACTIVATE_RELEASE`
- `TIMING_RESTART`
- `TIMING_HEALTH_CHECK`
- `TIMING_ROLLBACK` (on failure)

Build failures capture full stdout/stderr in the deploy log.

---

## Migration from v3 (server-side build)

### One-time server setup

1. Ensure `.env` exists at `DEPLOY_APP_PATH` (not inside individual releases)
2. Create layout (first deploy does this automatically):
   ```bash
   mkdir -p ~/buddyintro.com/releases ~/buddyintro.com/packages-incoming
   ```
3. **Reconfigure Passenger** (cPanel → Setup Node.js App):
   - Application root: `~/buddyintro.com/current`
   - Startup file: `index.js`
4. Run first v4 deploy from your machine: `npm run deploy`

### What changed

| v3 | v4 |
|----|-----|
| `git fetch && git reset` on server | SCP package upload |
| `npm run build` on server | Local `npm run build` only |
| Single git working tree | Timestamped `releases/` + `current` symlink |
| SHA rollback + rebuild | Release symlink rollback (instant) |

### Preserved

- SSH key authentication
- Deploy logging + failure diagnostics
- Health + version polling
- Git integrity gate (local, before build)
- Prisma migrate deploy on server
- Environment validation
- Deployment history (`deployment/history.json`)

---

## Files changed (refactor summary)

| File | Change |
|------|--------|
| `next.config.js` | Added `output: "standalone"` |
| `scripts/deploy.js` | v4 orchestrator (local build + release upload) |
| `scripts/lib/deploy-pipeline.js` | Shared deployment phases |
| `scripts/lib/deploy-package.js` | Standalone package assembly |
| `scripts/lib/deploy-releases.js` | Server release commands |
| `scripts/lib/artifact-upload.js` | SCP upload |
| `scripts/lib/deploy-metadata.js` | build.json generation |
| `scripts/lib/build-integrity.js` | Local build only |
| `scripts/lib/remote-deploy.js` | Re-exports release commands |
| `scripts/deploy-build.js` | `deploy:build` command |
| `scripts/deploy-upload.js` | `deploy:upload` command |
| `scripts/deploy-rollback.js` | `deploy:rollback` command |
| `scripts/deploy-clean.js` | `deploy:clean` command |
| `app/api/version/route.ts` | Reads deployment/build.json |
| `services/health.ts` | Exposes deployment metadata |
| `lib/deployment-info.ts` | Runtime metadata reader |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Local standalone build incomplete` | Run `npm run build` locally; verify `.next/standalone/server.js` exists |
| Passenger 503 after deploy | Confirm Passenger root is `current/` and startup file is `index.js` |
| Version mismatch | Ensure you pushed to GitHub before deploy; local build uses current HEAD |
| Prisma migrate fails | Check `DATABASE_URL` / `DIRECT_URL` in server `.env` |
| Rollback needed | `npm run deploy:rollback -- --list` then `--release=ID` |
