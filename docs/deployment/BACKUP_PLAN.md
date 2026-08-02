# Backup Plan

**Date:** 2026-07-26  
**Scripts:** `scripts/backup-database.ts`, `scripts/backup-nightly.js`, `scripts/restore.js`, `scripts/media-backup-sync.ts`

---

## Scope

| Asset | Method | Frequency |
|-------|--------|-----------|
| PostgreSQL | `pg_dump` via `npm run backup:database` | Daily + pre-deploy |
| Uploads (`MEDIA_ROOT`) | rsync/tar to `BACKUP_ROOT` | Daily |
| Environment | Encrypted copy of `.env` (not in git) | On change |
| PM2 config | Git tracked | Every release |

---

## Database backup

```bash
# Manual
npm run backup:database

# Nightly (cron)
0 3 * * * cd /home/buddyintro/app && npm run backup:nightly >> shared/logs/backup.log 2>&1
```

Output: `BACKUP_ROOT/YYYY-MM-DD/` or configured path.

**Retention:** 14 daily, 4 weekly (configure in `backup-nightly.js` / `DEPLOY_KEEP_BACKUPS`).

---

## Uploads backup

When `MEDIA_PROVIDER=local`:

```bash
npm run media:backup
# or rsync -a $MEDIA_ROOT $BACKUP_ROOT/uploads-$(date +%F)/
```

When using S3/R2: enable provider-native versioning + cross-region replication.

---

## Configuration backup

Store securely (password manager / vault):

- `.env` production file
- Supabase service role key
- Resend API key
- TLS certificates (Let's Encrypt auto-renew)
- SSH deploy keys

**Never commit secrets to git.**

---

## Restore procedure

### Database

```bash
npm run restore -- --backup=path/to/dump.sql
# Verify
npm run verify-database
```

### Uploads

```bash
rsync -a $BACKUP_ROOT/uploads-YYYY-MM-DD/ $MEDIA_ROOT/
```

### Full stack

1. Restore DB
2. Restore uploads
3. Checkout known-good git tag
4. `npm ci && npm run build`
5. `pm2 reload ecosystem.production.config.js`
6. Verify health + version

---

## Restore testing

| Frequency | Action |
|-----------|--------|
| Before launch | Restore DB dump to staging Supabase project |
| Monthly post-launch | `npm run backup:verify` |
| After schema migration | Test restore on clone |

---

## RPO / RTO targets (recommended)

| Metric | Target |
|--------|--------|
| RPO (data loss) | ≤ 24 hours (daily backup) |
| RTO (recovery) | ≤ 4 hours manual |

Improve to hourly DB backups post-launch if traffic warrants.

---

## Supabase managed backups

Enable Supabase Pro daily backups as **secondary** to self-managed `pg_dump`.

---

## Pre-launch backup checklist

- [ ] Run `npm run backup:database` — verify dump size > 0
- [ ] Run `npm run backup:verify`
- [ ] Document backup location on VPS
- [ ] Test restore on non-production database
- [ ] Confirm cron job installed
