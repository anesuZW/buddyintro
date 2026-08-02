# Private Beta Checklist — BuddyIntro

Complete **after deploying** current `main` to production. Check each box before inviting real users.

## Deploy verification

- [ ] Deploy includes commits `22d95fb` … `397f047` (or later)  
- [ ] `GET /api/health` → overall not degraded solely for missing Redis  
- [ ] `GET /api/health?verbose=1` → `redisConfigured` note OK if unset  
- [ ] PM2 process healthy; no crash loop  

## Auth

- [ ] Landing: single hero; header shows short “Sign up”  
- [ ] Login invalid password → durable red alert stays visible  
- [ ] Signup duplicate email → durable alert (not silent)  
- [ ] Signup primary button says “Create account”  
- [ ] Forgot password link on login  
- [ ] `/forgot-password` loads (no redirect loop)  
- [ ] Reset email received (Supabase Auth)  
- [ ] `/reset-password` sets new password → can login  

## Core product (one happy path)

- [ ] Login → Home feed loads  
- [ ] Create introduction/story with photo  
- [ ] Optional: video upload succeeds  
- [ ] View story playback  
- [ ] Owner sees Delete; delete removes story  
- [ ] Discoveries: post / like / comment / bookmark  
- [ ] Introductions list opens  
- [ ] Messages: open thread, send text  
- [ ] Notifications list loads  
- [ ] Profile: edit display name, save  
- [ ] Profile: Log out tappable above bottom nav  
- [ ] Login again → session restored  

## PWA / mobile

- [ ] `manifest.webmanifest` 200; SW activated  
- [ ] Offline banner when network cut  
- [ ] Mobile width ~390: bottom nav usable  
- [ ] (Optional device) Add to Home Screen / install prompt  

## Ops watch (first 24h)

- [ ] No recurring PM2 errors  
- [ ] No spike in 5xx on `/api/*`  
- [ ] Invite/reset email delivery confirmed  

## Invite gate

- [ ] All Critical/High checklist items above pass  
- [ ] First cohort size agreed (recommend ≤20)  
- [ ] Support contact / feedback channel ready  
