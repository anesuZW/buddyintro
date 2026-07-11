# BuddyIntro Release System

Professional release pipeline for Next.js + Prisma + Passenger deployment.

## Commands

| Command | Purpose |
| ------- | ------- |
| `npm run clean` | Remove `.next`, staging, cache |
| `npm run verify` | Lint + TypeScript + tests |
| `npm run package` | Build ZIP in `deployment/releases/` |
| `npm run release` | Full build pipeline + semver bump |
| `npm run publish` | Git tag + push + GitHub Release |
| `npm run doctor` | Pre-flight checks (SSH, GitHub, env, server) |
| `npm run deploy` | SSH deploy to InterServer (auto-rollback) |
| `npm run rollback` | Manual SSH rollback to prior git tag |
| `npm run health` | DB, Supabase, API, page checks |

## End-to-end release flow

```bash
npm run release -- --patch   # 1. Build + package + CHANGELOG
npm run publish              # 2. GitHub Release
npm run deploy               # 3. Deploy to InterServer
```

See [DEPLOYMENT_FLOW.md](./DEPLOYMENT_FLOW.md) for the full v2 pipeline diagram and safety rules.

### Release (`npm run release`)

1. Clean → Install → Prisma generate
2. Lint + TypeScript + tests
3. Production build
4. Deployment ZIP package
5. CHANGELOG + release notes
6. Verify deployment package
7. **Stops on any failure** — no deploy, no git push

```bash
npm run release              # patch bump (default)
npm run release -- --minor
npm run release -- --major
npm run release -- --no-bump
npm run release -- --dry-run
```

### Publish (`npm run publish`)

1. Verifies `gh` installed and authenticated
2. Verifies ZIP exists and tag/release are available
3. Verifies clean working tree
4. Generates `CHANGELOG.md` + release notes
5. Git commit → tag → push
6. GitHub Release with ZIP + CHANGELOG + notes
7. **Never overwrites** existing tags/releases
8. Removes local tag if push fails

### Deploy (`npm run deploy`)

SSH into InterServer (key-only). GitHub `origin/main` is source of truth:

```
SSH verify → clone if needed → git reset --hard origin/main → npm ci → prisma → restart → health
```

- Automatic rollback to previous tag if deploy fails after git sync
- Logs to `deployment/logs/deploy-*.log`
- Idempotent — safe to run multiple times

Configure in `.env`:

```
DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_KEY
DEPLOY_APP_PATH, DEPLOY_GIT_BRANCH, DEPLOY_HEALTH_URL
```

### Doctor (`npm run doctor`)

Pre-flight report: SSH, GitHub, GitHub CLI, Node, Prisma, Supabase, Database, env vars, server checks.

Status per check: **PASS** / **WARNING** / **FAIL**

## Repository layout

```
deployment/
  package.js          # ZIP packager
  releases/           # BuddyIntro-vX.Y.Z.zip
  logs/               # deploy-YYYY-MM-DD-HHMM.log
  templates/          # README_DEPLOY.md template
scripts/
  release.js          # Build pipeline
  publish.js          # GitHub publish
  deploy.js           # SSH deploy + auto-rollback
  rollback.js         # Manual rollback
  doctor.js           # Pre-flight checks
  lib/
    exec.js           # Cross-platform process execution
    deploy-logger.js  # Deployment log writer
    deploy-env.js     # Environment validation
    remote-deploy.js  # Remote command builders
    health-poll.js    # Health endpoint polling
    server-verify.js  # Server verification via SSH
```

## Cross-platform support

All scripts use `spawnSync` with `shell: false` and array arguments. Works on Windows PowerShell, CMD, Git Bash, Linux, and macOS.

## CI

GitHub Actions workflows in `.github/workflows/` provide parallel build and manual release paths. Local `npm run publish` is the canonical GitHub Release path with full safety checks.
