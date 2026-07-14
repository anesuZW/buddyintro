# BuddyIntro Prisma Migrations (Rebuilt 2026-07-14)

Fresh migration history generated from `schema.prisma` using `prisma migrate diff`.

## Design principles

- **`schema.prisma` is the single source of truth**
- **Baseline (`0001_baseline`) always runs first**
- Each migration depends only on prior migrations
- No `git pull` — deploy uses `npx prisma migrate deploy`
- RLS policies remain in `prisma/policies.sql` (run via `npm run db:rls` after migrate)

## Migration chain

```
0001_baseline          Core enums, users, stories, invitations, messages, posts, admin_settings, user_consents
0002_discoveries       Discoveries feed + conversation_contexts
0003_trust_graph       Trust graph, introduction categories, shared introducers (+ category seed)
0004_notifications     Notifications, preferences, push, analytics
0005_moderation        Phone verification, blocks, content reports
0006_platform          Background jobs
0007_security_rbac     RBAC, audit logs, security events (+ role seed)
```

## Fresh database bootstrap

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
npm run db:rls   # optional — Supabase RLS policies
```

## Validation

```bash
node scripts/validate-migrations.js
# Full reset test (destructive):
MIGRATION_TEST_RESET=1 node scripts/validate-migrations.js
```

## Archive

Previous migrations are preserved in:

```
prisma/migrations_archive/pre-rebuild-2026-07-14/
```

Do not delete the archive until production validation succeeds.

## Regenerating (maintainers)

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script -o prisma/_full_schema_diff.sql
node scripts/split-migration-sql.js
```

## Deployment pipeline

`npm run deploy` runs `npx prisma migrate deploy` on the server automatically — no manual SQL required for schema.
