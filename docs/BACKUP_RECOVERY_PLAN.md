# Backup & Disaster Recovery Plan

Generated: 2026-06-23

## npm scripts

| Script | Purpose |
| ------ | ------- |
| `npm run backup:database` | Export timestamped backup to `backups/<ISO-timestamp>/` |
| `npm run backup:verify` | Verify latest (or `--dir=`) backup integrity |

## Backup method

1. **Primary:** `pg_dump --format=custom` → `buddyintro.dump`
2. **Fallback:** Per-table JSONL export via `pg` client (when `pg_dump` unavailable)

Each backup includes:

- `manifest.json` — metadata, method, restore instructions
- `RESTORE.md` — human-readable restore steps

## Verified backup run

```
Backup: backups/2026-06-23T10-26-30-817Z
Method: pg_dump
Verify: PASS — backup integrity OK
```

## Restore instructions

### From pg_dump (recommended)

```bash
# Staging first — destructive on target DB
pg_restore --no-owner --no-acl -d "$DATABASE_URL" backups/<timestamp>/buddyintro.dump

# Re-apply RLS policies (not in Prisma migrations)
npm run db:rls

# Verify schema + orphans
npm run verify-database
npm run orphan-check

# Smoke test
npm run health-check
curl -sf http://localhost:3000/api/health
```

### From JSONL fallback

Import each `*.jsonl` file into corresponding table using `\copy` or custom import script. Then run RLS + verification as above.

## Production strategy

| Layer | Frequency | Retention |
| ----- | --------- | --------- |
| Supabase PITR | Continuous (Pro plan) | 7+ days |
| `npm run backup:database` | Daily cron | 30 days |
| Media bucket | Weekly sync | 90 days |

### Recommended cron (host with DATABASE_URL)

```bash
0 3 * * * cd /app && npm run backup:database && npm run backup:verify
```

## Disaster recovery sequence

1. Assess incident scope (DB, media, app)
2. Restore DB from Supabase PITR or latest `pg_dump`
3. Run `npm run db:rls && npm run verify-database`
4. Restore media bucket if needed
5. Roll back app deployment if schema mismatch
6. Run `npm run launch:validate -- --quick` on staging
7. Resume traffic

See also: `docs/DISASTER_RECOVERY.md`

## Status

**PASS** — Backup scripts implemented and verified locally.
