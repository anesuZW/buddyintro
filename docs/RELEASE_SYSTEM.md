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
| `npm run deploy` | SSH deploy to InterServer |
| `npm run rollback` | SSH rollback to prior git tag |
| `npm run health` | DB, Supabase, API, page checks |

## End-to-end release flow

```bash
# 1. Build and package
npm run release -- --patch

# 2. Publish to GitHub (never overwrites existing releases)
npm run publish

# 3. Deploy to InterServer via SSH
npm run deploy

# 4. Rollback if needed
npm run rollback
```

### Publish (`npm run publish`)

1. Verifies `deployment/releases/BuddyIntro-vX.Y.Z.zip` exists
2. Verifies git working tree is clean (or only release files pending)
3. Generates `CHANGELOG.md` + release notes
4. `git add` → `git commit` → `git tag` → `git push` → `git push --tags`
5. Creates GitHub Release with ZIP + CHANGELOG + release notes
6. **Stops on any failure** — never overwrites existing tags/releases

Requires: [GitHub CLI](https://cli.github.com/) (`gh auth login`)

### Deploy (`npm run deploy`)

SSH into InterServer (key-only, no passwords):

```
git pull → npm ci --omit=dev → prisma generate → migrate deploy → restart Passenger → /api/health
```

Configure in `.env`:

```
DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_KEY, DEPLOY_APP_PATH, DEPLOY_HEALTH_URL
```

### Rollback (`npm run rollback`)

Lists git tags, prompts for selection, SSH checkout + reinstall + restart + health verify.

## Release pipeline

```bash
npm run release              # patch bump (default)
npm run release -- --minor
npm run release -- --major
npm run release -- --no-bump   # package current version
npm run release -- --dry-run   # skip destructive steps
npm run release -- --commit --push   # git tag + push (manual approval)
```

Steps executed:

1. Clean → 2. Install → 3. Prisma generate → 4. Verify → 5. Build → 6. Package → 7. Release notes → 8. Optional git

## Repository layout

```
deployment/          Production packaging
  package.js           Creates BuddyIntro-vX.Y.Z.zip
  releases/            Generated artifacts (gitignored)
  templates/           README_DEPLOY.md template

scripts/               Production operations
  clean.js verify.js package.js release.js
  deploy.js rollback.js healthcheck.js
  lib/                 Shared release utilities

tools/                 Dev-only utilities (benchmarks, audits)

docs/deployment/       Passenger hosting guide

.cursor/rules/         Permanent Cursor project rules

.github/workflows/     CI build + manual release
```

## Semantic versioning

Version in `package.json` follows **semver**. Release bumps patch/minor/major automatically.

## CI/CD

- **build.yml** — runs on push/PR: verify + build + upload artifact
- **release.yml** — manual `workflow_dispatch` with `release-approval` environment; creates **draft** GitHub Release (never auto-deploys to production)

## Cursor rules

See `.cursor/rules/buddyintro.md` for permanent engineering standards.

## Passenger

See [docs/deployment/PASSENGER.md](./deployment/PASSENGER.md).
