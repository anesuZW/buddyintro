# Rollback Procedure

**Date:** 2026-07-26  
**Scripts:** `npm run deploy:rollback`, `scripts/deploy-rollback.js`, `scripts/restore.js`

---

## When to rollback

| Trigger | Action |
|---------|--------|
| Health check fails > 5 min post-deploy | Rollback code |
| Error rate > 5% sustained | Rollback code |
| Data corruption suspected | Stop traffic + restore DB |
| Bad migration | **Do not** rollback code alone — restore DB |

---

## 1. Code rollback (fast — ~5 minutes)

### PM2 + git release

```bash
cd /home/buddyintro/app

# Option A: deploy script
npm run deploy:rollback

# Option B: manual
git checkout <previous-tag-or-sha>
npm ci --omit=dev
npm run build
pm2 reload ecosystem.production.config.js
```

### Verify

```bash
curl -s https://buddyintro.com/api/version | jq .commit
node scripts/verify-deployment.js
```

---

## 2. PM2-only restart (no code change)

```bash
pm2 restart ecosystem.production.config.js
# or last known good
pm2 resurrect   # if pm2 save was run before bad deploy
```

---

## 3. Database rollback

**Prisma migrations are forward-only.** To undo a migration:

1. Stop app: `pm2 stop all`
2. Restore pre-migration dump:
   ```bash
   npm run restore -- --backup=shared/backups/YYYY-MM-DD/db.sql
   ```
3. Checkout code matching that schema
4. `npm run build && pm2 start ecosystem.production.config.js`

**Prevention:** Always backup before `prisma migrate deploy`.

---

## 4. Uploads rollback

```bash
rsync -a --delete $BACKUP_ROOT/uploads-YYYY-MM-DD/ $MEDIA_ROOT/
```

Only if bad deploy corrupted uploads. Media objects in DB may reference paths — coordinate with DB restore.

---

## 5. Environment rollback

1. Restore previous `.env` from secure backup
2. `pm2 reload ecosystem.production.config.js --update-env`
3. Verify `npm run startup-check`

---

## 6. Nginx rollback

```bash
sudo cp /etc/nginx/sites-available/buddyintro.conf.bak /etc/nginx/sites-available/buddyintro.conf
sudo nginx -t && sudo systemctl reload nginx
```

Keep `.bak` before each nginx change.

---

## 7. Cloudflare rollback

- Revert DNS if changed
- Disable new WAF rules
- Purge cache if stale assets served

---

## Rollback decision matrix

| Failure type | Code | DB | Uploads | Nginx |
|--------------|------|-----|---------|-------|
| App crash loop | ✅ | — | — | — |
| API logic bug | ✅ | — | — | — |
| Bad migration | ✅ (prev) | ✅ restore | maybe | — |
| Upload corruption | — | — | ✅ | — |
| TLS/nginx misconfig | — | — | — | ✅ |

---

## Post-rollback

1. Announce status to team
2. Document incident timeline
3. Fix forward on branch; do not re-deploy until RC smoke passes
4. Root cause within 24h

---

## Blue/green (advanced)

`scripts/lib/deploy-bluegreen.js` supports staged releases. See `docs/DEPLOYMENT_PIPELINE.md`.

For first launch, git tag rollback is sufficient.
