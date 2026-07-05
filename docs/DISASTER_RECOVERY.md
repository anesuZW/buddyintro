# Disaster Recovery Guide

Operational procedures for FriendIntro production incidents.

## Prerequisites

- Access to Supabase project dashboard (database + storage)
- `DATABASE_URL` / `DIRECT_URL` credentials
- Latest application deployment artifact (git tag or Vercel deployment)
- `.env` backup (secrets vault — **never commit**)

---

## 1. Database restore

### Supabase point-in-time recovery (recommended)

1. Open Supabase → **Database** → **Backups**
2. Select restore point before the incident
3. Restore to a **new** project or branch if possible (safer validation)
4. Update `DATABASE_URL` and `DIRECT_URL` in production env
5. Run verification:
   ```bash
   npm run verify-database
   npm run health-check
   ```

### Manual dump restore

If you have a `pg_dump` backup:

```bash
# Restore (destructive — use on empty or staging DB first)
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pg_restore --no-owner --no-acl -d "$DATABASE_URL" friendintro_backup.dump

# Re-apply RLS (not in Prisma migrations)
npm run db:rls

# Verify
npm run verify-database
```

---

## 2. Media restore

Media lives in the private Supabase bucket `friendintro` (path: `{userId}/...`).

1. Supabase → **Storage** → `friendintro` → restore from backup or replicate bucket
2. Confirm bucket remains **private** (`public = false`)
3. Re-run storage policies via `npm run db:rls`
4. Health check:
   ```bash
   npm run health-check
   curl https://your-domain/api/health
   ```

If individual objects are missing, users may need to re-upload profile/story media; DB rows referencing missing paths should be cleaned with `npm run orphan-check`.

---

## 3. Application rollback

### Vercel / hosted Next.js

1. Identify last known-good deployment in hosting dashboard
2. Promote rollback deployment to production
3. Ensure env vars match the restored database era (especially if schema changed)

### Git-based rollback

```bash
git checkout <last-good-tag>
npm ci
npm run build
# redeploy artifact
```

After rollback, confirm `/api/health` returns `healthy` or acceptable `degraded`.

---

## 4. Migration rollback

Prisma migrations are **forward-only** in production. To undo a bad migration:

1. **Preferred:** Restore database to pre-migration backup (section 1)
2. **Alternative:** Write a compensating migration that reverses DDL manually

Never use `prisma migrate reset` on production.

### Compensating migration checklist

- Create `prisma/migrations/YYYYMMDD_revert_<name>/migration.sql` with inverse DDL
- Test on staging with `npm run prisma:deploy`
- Run `npm run verify-database`
- Re-apply `npm run db:rls` if policy functions changed

---

## 5. Trust graph rebuild

After large data restore or corruption:

```bash
npm run rebuild-connections
# Or enqueue via admin jobs dashboard / worker:
npm run job-worker
```

Monitor `/maindash/system-health` for graph materialization status.

---

## 6. Background jobs recovery

1. Check `/maindash/jobs` for `dead` and `failed` queues
2. Ensure `enableBackgroundJobs` is set appropriately in admin settings
3. Start worker process:
   ```bash
   npm run job-worker
   ```
4. Re-enqueue critical jobs manually via admin API if needed

---

## 7. Incident communication

1. Log incident in `admin_audit_logs` (manual entry if app unavailable)
2. Use admin announcements (`/maindash` → Announcements) once restored
3. Review `security_events` and `/maindash/security` for post-incident forensics

---

## 8. Post-incident verification checklist

- [ ] `npm run verify-database` — all checks pass
- [ ] `npm run health-check` — not unhealthy
- [ ] `/api/health` — acceptable status
- [ ] RLS policies applied (`npm run db:rls` if fresh DB)
- [ ] Job worker running for async pipelines
- [ ] Trust graph rebuilt if connections were affected
- [ ] Admin RBAC roles intact (`/maindash/admin-users`)

---

## Contacts & runbooks

Document your on-call rotation and Supabase support tier here for your organization.
