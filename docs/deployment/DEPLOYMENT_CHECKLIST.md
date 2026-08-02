# Production Deployment Checklist

**Date:** 2026-07-26  
**Target:** InterServer VPS + Cloudflare + Supabase  
**App:** BuddyIntro v0.1.3

Use this checklist for **first production deploy** and every subsequent release.

---

## 1. Server preparation

- [ ] Ubuntu VPS provisioned (≥ 2 vCPU, 4 GB RAM recommended)
- [ ] Node.js ≥ 18.17 installed (`DEPLOY_NODE_BIN` if CloudLinux)
- [ ] PM2 installed globally: `npm i -g pm2`
- [ ] Nginx installed and enabled
- [ ] ffmpeg on PATH (video processing)
- [ ] Redis installed locally OR managed Redis URL (recommended)
- [ ] User `buddyintro` created with deploy SSH key
- [ ] Directories: `/home/buddyintro/app`, `shared/logs`, `shared/uploads`

---

## 2. DNS & SSL

- [ ] A/AAAA record → VPS IP (or Cloudflare proxy)
- [ ] `www` CNAME or redirect to apex
- [ ] Let's Encrypt: `certbot --nginx -d buddyintro.com -d www.buddyintro.com`
- [ ] Cloudflare SSL: **Full (strict)**
- [ ] `NEXT_PUBLIC_APP_URL=https://buddyintro.com`

---

## 3. Cloudflare

- [ ] Proxy enabled (orange cloud) OR DNS-only if direct TLS
- [ ] WAF basic rules enabled
- [ ] Cache: bypass for `/api/*`, `/sw.js`
- [ ] WebSockets: not required (Supabase realtime direct)

---

## 4. Supabase

- [ ] Production project created
- [ ] `DATABASE_URL` (pooler) + `DIRECT_URL` (direct) configured
- [ ] Auth redirect URLs include production domain
- [ ] Email templates reviewed
- [ ] Connection pool size adequate for PM2 instances
- [ ] Pro backups enabled (recommended)

---

## 5. Environment variables

- [ ] Copy from `docs/deployment/ENVIRONMENT_VARIABLES.md`
- [ ] `.env` on server (permissions 600)
- [ ] `MEDIA_ROOT=/home/buddyintro/shared/uploads`
- [ ] `RESEND_API_KEY` + verified sending domain
- [ ] `REDIS_URL` set
- [ ] `VAPID_*` keys generated
- [ ] `ADMIN_EMAILS` set
- [ ] Legal entity fields filled
- [ ] Profiling vars **unset** (`PROFILE_*`, `AUTH_PROFILE`)
- [ ] Run `npm run startup-check` on server

---

## 6. Database

- [ ] `npm run prisma:deploy` (on `DIRECT_URL`)
- [ ] `npm run verify-database`
- [ ] `npm run db:rls` (apply RLS policies)
- [ ] Pre-migration backup taken

---

## 7. Build & deploy

- [ ] `pm2 stop all`
- [ ] `git fetch && git checkout <release-tag>`
- [ ] `npm ci --omit=dev`
- [ ] `npm run build` (must complete standalone verify)
- [ ] `node scripts/verify-standalone-build.js`
- [ ] `pm2 start ecosystem.production.config.js`
- [ ] `pm2 save`

---

## 8. Nginx

- [ ] Copy `docs/deployment/nginx.conf` → `/etc/nginx/sites-available/buddyintro.conf`
- [ ] Update paths (`alias` for uploads, standalone static)
- [ ] `nginx -t && systemctl reload nginx`
- [ ] `client_max_body_size 26m` confirmed

---

## 9. Uploads & storage

- [ ] `shared/uploads` owned by app user, writable
- [ ] Nginx `/uploads/` alias matches `MEDIA_ROOT`
- [ ] Test upload ≤ 25 MB through Nginx (not just localhost)

---

## 10. Email

- [ ] `npm run verify:email` against production
- [ ] Send test invitation to real inbox
- [ ] Verify Resend domain DNS (SPF, DKIM, DMARC)

---

## 11. Health checks

- [ ] `curl https://buddyintro.com/api/health` → 200
- [ ] `curl https://buddyintro.com/api/version` → matches git SHA
- [ ] `npm run deploy:verify-runtime`
- [ ] External uptime monitor configured

---

## 12. Monitoring & backups

- [ ] PM2 startup script: `pm2 startup` + `pm2 save`
- [ ] Logrotate configured (`LOGGING.md`)
- [ ] Nightly backup cron (`BACKUP_PLAN.md`)
- [ ] Restore test completed on staging

---

## 13. Smoke tests (production)

- [ ] Login / logout
- [ ] Create introduction (user tag)
- [ ] Upload image story
- [ ] Discovery post + like
- [ ] Send message
- [ ] Notification received
- [ ] PWA install prompt (HTTPS)

Optional: `npx tsx scripts/rc2-validation.ts --base=https://buddyintro.com`

---

## 14. Rollback readiness

- [ ] Previous release tag documented
- [ ] Pre-deploy DB backup verified
- [ ] Rollback procedure reviewed (`ROLLBACK.md`)
- [ ] On-call contact assigned

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Release Manager | | | |
| DevOps | | | |
| Backend | | | |
