# Private Beta — Release Checklist

## Pre-invite (required)

- [ ] Production `DATABASE_URL` uses pooler; Prisma singleton confirmed in app runtime  
- [ ] Nginx `client_max_body_size ≥ 26m`; proxy body/read timeouts ≥ 120s  
- [ ] `NODE_ENV=production` build + PM2 apps healthy (`buddyintro`, media worker)  
- [ ] HTTPS certificate valid  
- [ ] CSRF / site URL env matches public origin  
- [ ] Smoke: login → home → discoveries → create story (photo) → messages → logout  

## Push (optional for first cohort)

- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` set  
- [ ] If Redis: `buddyintro-push-worker` running  
- [ ] Device: Enable push → test notification → tap deep link  

## Device smoke (one Android or iOS)

- [ ] Add to Home Screen / install  
- [ ] Standalone launch  
- [ ] Offline → offline shell  
- [ ] Upload phone photo  
- [ ] Upload short video < 25 MB  
- [ ] Cancel mid-upload  
- [ ] Send message; switch chats (no bleed)  
- [ ] Like a discovery (instant UI)  

## Security / ops

- [ ] Restrict `/api/metrics` at nginx (or auth)  
- [ ] Confirm admin emails / RBAC  
- [ ] Backup / rollback plan known (`docs/deployment`)  

## Monitoring first 48h

- [ ] Watch 503 / `service_unavailable` rate  
- [ ] Watch upload `413` / `storage_error`  
- [ ] Watch empty 500s (should be ~0 on user APIs)  
- [ ] Collect cohort feedback on “feels slow” vs crash  

## Sign-off

| Role | Name | Date |
|------|------|------|
| Release manager | | |
| Ops | | |
