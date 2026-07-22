# BuddyIntro Production Deployment Pipeline

This document describes how production builds are produced, how version metadata flows into the running server, and why stale standalone bundles can no longer survive deployment.

## Problem (historical root cause)

Production reported commit `ce43c13` via `GET /api/version` while the repository HEAD and root manifests showed `da34074`.

**Proven cause:**

1. `npm run build` writes version manifests only into **`.next/standalone/`** (not the repo root).
2. Next.js `output: "standalone"` emits `.next/standalone/server.js` but does **not** copy static assets, `public/`, or custom manifests into the bundle.
3. PM2 previously used an ambiguous working directory (`APP_ROOT || process.cwd()`) with `script: "server.js"`. When cwd pointed at a stale or partially updated standalone tree, `/api/version` read old manifests inside that tree while root manifests were updated on disk.
4. Packaging scripts (`deploy-package.js`) copied manifests into release staging, but a plain `npm run build` + `pm2 restart` on the VPS did not guarantee standalone sync or runtime verification.

The running process was therefore serving an older standalone bundle whose embedded manifests did not match git HEAD.

---

## Build dependency graph

Every step from `npm run build` to PM2 is explicit:

```
npm run build
    │
    ├─► scripts/clean-build.js
    │       rm -rf .next  (eliminates stale standalone/cache)
    │
    ├─► prisma generate
    │
    ├─► scripts/generate-pwa-icons.js
    │
    ├─► next build
    │       creates .next/standalone/server.js (Next.js standalone output)
    │
    ├─► scripts/build-sw.js             (generates public/sw.js — gitignored)
    │
    ├─► scripts/sync-standalone.js
    │       scripts/lib/standalone-sync.js:
    │         • copy .next/static → .next/standalone/.next/static
    │         • copy public/ → .next/standalone/public
    │         • write manifests INTO .next/standalone/
    │
    └─► scripts/verify-standalone-build.js
            fails build if standalone manifests ≠ git rev-parse HEAD

pm2 restart ecosystem.config.js
    │
    ├─► buddyintro app: cwd = .next/standalone, script = server.js
    └─► workers: cwd = project root (scripts/, prisma/, node_modules)

scripts/verify-deployment.js  (post-deploy)
    git rev-parse HEAD  vs  GET /api/version
    mismatch → exit 1 (deployment abort)
```

There is no hidden copy step, no manual `APP_ROOT`, and no reuse of a previous standalone tree because `.next` is deleted before every build.

---

## Standalone generation

| Question | Answer |
|----------|--------|
| Who creates `.next/standalone`? | **Next.js** during `next build` when `output: "standalone"` is set in `next.config.js`. |
| Is it copied from elsewhere? | **No.** It is generated fresh after `clean-build.js` removes `.next`. |
| Is it overwritten after build? | **Yes, augmented** by `syncStandaloneBundle()` — static, public, and manifests are copied/written in. |
| Is it restored from cache? | **No.** `.next` (including cache) is removed before each build. |
| Is it packaged from another directory? | Release packaging (`deploy-package.js`) copies the already-synced standalone from the repo into staging; it calls `syncStandaloneBundle()` before copy as a safety net. |

### Exact sequence

1. `clean-build.js` → delete `.next`
2. `next build` → create `.next/standalone/server.js` + traced node_modules
3. `build-sw.js` → generate `public/sw.js` (gitignored build output)
4. `sync-standalone.js` → materialize runnable bundle under `.next/standalone`
5. `verify-standalone-build.js` → assert manifests match `git HEAD`

---

## Version manifest integrity

### Files

| Path | Purpose |
|------|---------|
| `deployment/build.json` | Full build metadata (commit, branch, versions, deploymentId) |
| `build/version.json` | Slim version payload for `/api/version` fallback |

Both exist inside **`.next/standalone/`** at runtime. Repo-root `build/` and `deployment/build.json` / `deployment/manifest.json` are **generated** and gitignored — do not commit them.

### Runtime behavior

`app/api/version/route.ts` reads manifests from `process.cwd()` only:

- Primary: `.next/standalone/deployment/build.json` (when PM2 cwd is standalone)
- Fallback: `.next/standalone/build/version.json`

PM2 sets `cwd` to `.next/standalone`, so the API never reads manifests outside the deployed bundle.

---

## PM2 configuration

File: `ecosystem.config.js`

| Process | cwd | script |
|---------|-----|--------|
| `buddyintro` | `{PROJECT_ROOT}/.next/standalone` | `server.js` |
| `buddyintro-*-worker` | `{PROJECT_ROOT}` | `tsx …/scripts/*-worker.ts` |

- `PROJECT_ROOT` defaults to the directory containing `ecosystem.config.js` (works in repo checkout and blue/green release dirs).
- Config **throws at load time** if `.next/standalone/server.js` is missing — forces `npm run build` before start.
- No `APP_ROOT` override is required for normal operation.

Start/restart:

```bash
npm run build
pm2 start ecosystem.config.js    # first time
pm2 restart ecosystem.config.js  # subsequent deploys
```

---

## Production deploy (one command)

```bash
npm run deploy:production
```

Equivalent steps:

```
git pull --ff-only
npm install
npx prisma generate
npm run build          # clean → build → sync → verify standalone
pm2 restart ecosystem.config.js --update-env
node scripts/verify-deployment.js
```

If `/api/version` commit ≠ `git rev-parse HEAD`, the script exits with code 1.

Manual runtime check:

```bash
npm run deploy:verify-runtime
# optional: npm run deploy:verify-runtime -- --url=http://127.0.0.1:3000
```

---

## Blue/green deploy (`deploy-v3`)

After health check passes, `deploy-v3.js` runs `scripts/verify-deployment.js` against the live server. Smoke tests in `deploy-bluegreen.js` verify `.next/standalone/server.js` exists and run `verify-standalone-build.js` in the release directory before activation.

---

## Why stale standalone builds cannot recur

| Guard | Mechanism |
|-------|-----------|
| Pre-build clean | `clean-build.js` removes entire `.next` tree |
| Post-build sync | Manifests + static + public copied into standalone |
| Build-time verify | `verify-standalone-build.js` fails if manifests ≠ HEAD |
| PM2 cwd lock | App always runs from `.next/standalone` |
| Post-deploy verify | `verify-deployment.js` compares runtime API to git HEAD |
| No external manifest reads | `/api/version` uses `process.cwd()` inside standalone |

A stale bundle cannot pass `npm run build` (manifest mismatch) or `deploy:production` (runtime mismatch).

---

## Recovery procedure

If production serves the wrong commit:

1. **Confirm drift**

   ```bash
   git rev-parse HEAD
   curl -s http://127.0.0.1:3000/api/version | jq .commit
   ```

2. **Full redeploy**

   ```bash
   npm run deploy:production
   ```

   This rebuilds from clean `.next`, syncs standalone, restarts PM2, and verifies runtime.

3. **If deploy fails at build verify**

   - Ensure you are in a git checkout (not a partial artifact tree).
   - Check `cat .next/standalone/deployment/build.json` vs `git rev-parse HEAD`.
   - Re-run `npm run build` — do not skip sync/verify steps.

4. **If deploy fails at runtime verify**

   - Confirm PM2 is using this repo’s ecosystem file: `pm2 describe buddyintro` → check `exec cwd` is `…/.next/standalone`.
   - Kill orphan processes: `pm2 delete all` then `pm2 start ecosystem.config.js` from the release root.
   - Ensure nothing else binds port 3000.

5. **Rollback (blue/green)**

   ```bash
   npm run deploy:v3 -- rollback
   ```

   Then verify runtime again with `npm run deploy:verify-runtime`.

---

## Related scripts

| Script | Role |
|--------|------|
| `scripts/clean-build.js` | Remove `.next` before build |
| `scripts/sync-standalone.js` | CLI wrapper for `syncStandaloneBundle()` |
| `scripts/verify-standalone-build.js` | Build-time manifest integrity |
| `scripts/verify-deployment.js` | Post-deploy runtime integrity |
| `scripts/deploy-production.js` | Full VPS deploy orchestration |
| `scripts/lib/standalone-sync.js` | Shared sync + verify logic |
| `scripts/lib/build-integrity.js` | Artifact checklist for packaging |

---

## Validation checklist

After any pipeline change, confirm:

- [ ] `npm run build` succeeds
- [ ] `.next/standalone/deployment/build.json` commit matches `git rev-parse HEAD`
- [ ] `.next/standalone/build/version.json` commit matches `git rev-parse HEAD`
- [ ] `pm2 restart ecosystem.config.js` starts without `APP_ROOT`
- [ ] `npm run deploy:verify-runtime` passes
- [ ] `GET /api/version` returns the same commit as git HEAD
