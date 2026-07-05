# BuddyIntro Production Deployment

Generated: {{GENERATED_AT}}  
Version: {{VERSION}}

## Requirements

- Node.js 18 LTS or 20 LTS
- PostgreSQL (Supabase)
- cPanel Passenger or `node index.js`

## Install on server

```bash
unzip BuddyIntro-v{{VERSION}}.zip -d ~/buddyintro
cd ~/buddyintro
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy
```

## Environment

Set all variables from `.env.example` in cPanel → Setup Node.js App.

Required: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAILS`.

Recommended: `RESEND_API_KEY`, `EMAIL_FROM`.

**Never set** `PROFILE_PRODUCTION`, `AUTH_PROFILE`, or `HEALTH_MONITORING` in production unless debugging.

## Passenger

- **Startup file:** `index.js`
- **NODE_ENV:** `production`
- **Restart:** `mkdir -p tmp && touch tmp/restart.txt`

## Verify

```bash
curl -sf https://your-domain.com/api/health
```

## Rollback

Keep previous ZIP in `deployment/releases/`. Redeploy prior version and restart Passenger.
