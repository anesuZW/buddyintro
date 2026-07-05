# BuddyIntro — Cursor Project Rules

Permanent engineering standards for BuddyIntro. Follow on every change.

## Production-first

- Ship only code that is safe on **Passenger / InterServer** with `NODE_ENV=production`.
- Verify **Passenger compatibility** (`index.js`, `PORT`, `prisma generate` on server) before merging release changes.
- Generate **deployment packages** (`npm run package`) after successful builds.
- Prefer fixing performance and reliability over new features.

## Security

- **Never expose secrets** in code, logs, commits, or client bundles.
- **Never remove authentication** from protected routes or APIs.
- Do not enable `PROFILE_*`, `AUTH_PROFILE`, or bench routes in production unless explicitly debugging.
- Keep `/api/public` and `/api/health` intentionally public; everything else stays authenticated.

## Data & migrations

- **Never delete Prisma migrations** once applied to any environment.
- Run `prisma migrate deploy` on production — never `migrate dev`.
- Do not run demo or simulation seeds (`seed:demo`, `seed:simulation`) against production databases.
- **Never introduce demo users into production.**

## Architecture & changes

- **Explain architectural changes** before implementing non-trivial refactors.
- Match existing patterns in `app/`, `services/`, and `lib/`.
- Minimize diff scope; do not refactor unrelated code in the same PR.
- Keep dev-only tools in `tools/`; keep production ops in `scripts/`.

## Release discipline

- Use **semantic versioning** (`npm run release -- --patch|--minor|--major`).
- Run `npm run verify` before release.
- Update release notes for user-visible changes.
- Never force-push `main`.

## Stack conventions

- Next.js 14 App Router, TypeScript strict, Prisma + Supabase PostgreSQL.
- Server-only secrets via `server-only` modules and env vars.
- Middleware session refresh via `lib/supabase/middleware.ts` — do not bypass without security review.

## When uncertain

Stop and ask for confirmation rather than guessing on auth, migrations, or deployment.
