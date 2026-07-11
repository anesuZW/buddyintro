# BuddyIntro Deployment Flow (v2)

Production-grade pipeline: **one command per stage**, automatic rollback on deploy failure.

## Pipeline overview

```mermaid
flowchart TD
  subgraph local [Local Machine]
    R[npm run release]
    P[npm run publish]
    D[npm run doctor]
    DEP[npm run deploy]
  end

  subgraph checks [Release Verification]
    C[clean / install / prisma]
    V[lint + tsc + tests]
    B[production build]
    Z[ZIP package]
    CL[CHANGELOG + notes]
  end

  subgraph github [GitHub]
    TAG[vX.Y.Z tag]
    REL[GitHub Release + assets]
    MAIN[origin/main]
  end

  subgraph server [InterServer SSH]
    SSH[SSH key auth]
    SYNC[git reset --hard origin/main]
    CI[npm ci --omit=dev]
    PR[prisma generate + migrate deploy]
    RS[touch tmp/restart.txt]
    HC[/api/health]
    RB[auto rollback to previous tag]
  end

  R --> checks
  P --> TAG --> REL
  DEP --> SSH --> SYNC --> CI --> PR --> RS --> HC
  HC -->|fail after sync| RB
  MAIN --> SYNC
  REL -.->|source of truth| MAIN
```

## Three-command deploy

```bash
# 1. Build, verify, package (no deploy)
npm run release -- --patch

# 2. Tag, push, GitHub Release
npm run publish

# 3. Deploy to InterServer (auto-rollback on failure)
npm run deploy
```

Optional pre-flight:

```bash
npm run doctor
```

## Stage 1: Release (`npm run release`)

| Step | Action |
|------|--------|
| 1 | Clean build artifacts |
| 2 | `npm install` |
| 3 | `npx prisma generate` |
| 4 | Lint + TypeScript + tests |
| 5 | Production build |
| 6 | Create `deployment/releases/BuddyIntro-vX.Y.Z.zip` |
| 7 | Generate `CHANGELOG.md` + release notes |
| 8 | Verify ZIP size and integrity |

**Stops immediately** on any failure. No git push, no deploy.

## Stage 2: Publish (`npm run publish`)

| Step | Action |
|------|--------|
| 1 | Verify `gh` installed and authenticated |
| 2 | Verify ZIP exists |
| 3 | Verify tag/release do not already exist |
| 4 | Verify clean working tree |
| 5 | Commit release files |
| 6 | Create annotated tag |
| 7 | Push branch + tags |
| 8 | Create GitHub Release with ZIP, CHANGELOG, notes |

**Safety:** Never overwrites tags/releases. Removes local tag if push fails before remote update.

## Stage 3: Deploy (`npm run deploy`)

| Step | Action |
|------|--------|
| 1 | SSH with public-key auth only (`BatchMode=yes`) |
| 2 | Verify server reachable |
| 3 | Clone repo if missing |
| 4 | `git fetch origin` → `git reset --hard origin/main` → `git clean -fd` |
| 5 | Verify Node.js >= 18.17.0 |
| 6 | `npm ci --omit=dev` |
| 7 | `npx prisma generate` |
| 8 | `npx prisma migrate deploy` (never `db push`) |
| 9 | `touch tmp/restart.txt` (Passenger restart) |
| 10 | Poll `/api/health` every 5s (max 120s) |

**Idempotent:** Running deploy twice always converges to `origin/main` state.

**GitHub is source of truth:** Never uses `git pull` or merge commits.

### Automatic rollback

If deploy fails **after** `git reset --hard origin/main`:

1. Capture previous tag/commit before sync
2. `git checkout <previous_ref>`
3. `npm ci --omit=dev` + `npx prisma generate`
4. Restart Passenger
5. Health check

| Outcome | Message |
|---------|---------|
| Health OK | `ROLLBACK SUCCESSFUL` |
| Health fail | `MANUAL INTERVENTION REQUIRED` |

## Deployment logs

Every deploy writes:

```
deployment/logs/deploy-YYYY-MM-DD-HHMM.log
```

Includes timestamps, commands, stdout/stderr, duration, and final status.

## Safety guarantees

| Rule | Enforcement |
|------|-------------|
| Never delete data | No `DROP`, `db push`, or storage deletion |
| Never reset production DB | Only `prisma migrate deploy` |
| Never overwrite `.env` | Server env verified via `grep`, never written |
| Never overwrite uploads | `git clean -fd` only removes untracked build files |
| SSH key only | `PasswordAuthentication=no`, `BatchMode=yes` |

## Required environment variables

Must be present in **server** `.env` (verified before deploy):

- `DATABASE_URL`, `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAILS`

Must be present **locally** for deploy:

- `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY`

See `.env.example` for full list.

## Manual setup (one-time)

1. **SSH key:** Generate ed25519 key, add public key to InterServer cPanel → SSH Access
2. **Server `.env`:** Copy from `.env.example`, set all required vars in cPanel Node.js app
3. **GitHub CLI:** `gh auth login` on local machine
4. **Local `.env`:** Set `DEPLOY_*` variables
5. **First clone:** Deploy auto-clones if `~/buddyintro` does not exist

## Troubleshooting

```bash
npm run doctor          # Pre-flight checks (SSH, GitHub, env, server)
npm run health          # Post-deploy health suite
npm run rollback        # Manual rollback to prior tag
```

Log file path is printed at end of every deploy.
