# Prisma Migrations

FriendIntro uses **Prisma Migrate** starting 2026-05-24.

## Active migrations

| Folder | Purpose |
|--------|---------|
| `2026_baseline/` | Idempotent baseline — existing schema, enums, indexes, core FKs |
| `2026_database_alignment/` | FK repair, admin default fix, `user_connections` table |

## Legacy manual SQL (superseded)

These files were applied manually before Prisma Migrate adoption. **Do not re-run** on production; kept for historical reference:

- `introduction_network_controls.sql`
- `introductions_never_expire.sql`
- `introduction_graph_and_context.sql`
- `add_invitation_expires_at.sql`
- `platform_extension.sql`

## Commands

```bash
# Pre-flight orphan check
npm run orphan-check

# Apply migrations (production)
npx prisma migrate deploy

# Regenerate client
npx prisma generate

# Verify schema
npm run verify-database

# Backfill introduction graph
npm run rebuild-connections
```

## Existing database bootstrap

If `_prisma_migrations` did not exist before first deploy, `migrate deploy` creates it and records applied migrations automatically.
