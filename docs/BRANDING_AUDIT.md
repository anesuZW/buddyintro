# BuddyIntro Branding Audit

Rebrand completed: **FriendIntro → BuddyIntro** (user-facing only). Central config: `lib/branding.ts`.

```ts
export const BRAND = {
  name: "BuddyIntro",
  tagline: "Discover trusted people through people you already trust",
  shortName: "Buddy",
  domain: "buddyintro.com",
};
```

---

## Files modified

| File | Change |
|------|--------|
| `lib/branding.ts` | **Created** — centralized `BRAND`, URLs, email defaults, initials |
| `lib/copy.ts` | `appName`, `tagline`, and all FriendIntro strings → `BRAND.name` / `BRAND.tagline` |
| `app/layout.tsx` | Metadata, OpenGraph, Twitter cards, `metadataBase`, apple web app title |
| `app/manifest.ts` | **Created** — dynamic PWA manifest from `BRAND` |
| `public/manifest.webmanifest` | **Deleted** — replaced by `app/manifest.ts` |
| `components/layout/TopBar.tsx` | Navbar logo initials + name |
| `app/page.tsx` | Landing header + logo monogram `{BRAND_INITIALS}` |
| `app/offline/page.tsx` | Uses `COPY.appName` — no direct edit needed |
| `app/privacy/page.tsx` | Legal copy + back link |
| `app/terms/page.tsx` | Legal copy + back link |
| `app/cookies/page.tsx` | Back link |
| `app/invite-preview/[token]/page.tsx` | Page metadata (title, description, OG) |
| `components/legal/CookieConsentBanner.tsx` | Cookie banner copy |
| `components/feed/FeedList.tsx` | Uses `COPY.appName` — no direct edit needed |
| `components/discoveries/DiscoveriesFeed.tsx` | Web Share API title |
| `components/introductions/IntroductionCard.tsx` | Web Share API title |
| `components/stories/StoryUploader.tsx` | Tag-user hints |
| `components/notifications/PushEnableButton.tsx` | Push enable copy |
| `components/invite/SignupClient.tsx` | Welcome toast + heading |
| `components/invite/InviteLandingClient.tsx` | Invite landing headline |
| `components/invite/InviteOnboardingShell.tsx` | Onboarding background text |
| `components/invite/InvitePreviewViewer.tsx` | Preview overlay brand label |
| `components/pwa/PwaShell.tsx` | Uses `COPY.installApp` — no direct edit needed |
| `app/(auth)/login/page.tsx` | Uses `COPY` — no direct edit needed |
| `app/(main)/share/page.tsx` | Uses `COPY.appName` — no direct edit needed |
| `lib/invite-share.ts` | SMS/WhatsApp invite message prefix |
| `lib/introduction-graph.ts` | Connection reason detail string |
| `services/email.ts` | Default `From` display name via `BRAND_EMAIL_FROM` |
| `services/email-templates/invitation-story.ts` | HTML/text/subject/preview; logo initials |
| `services/invites.ts` | Story invitation preview text |
| `services/notifications/emitters.ts` | Introduction received notification message |
| `services/notifications/notification-email.ts` | CTA label + default app URL |
| `services/notifications/notification-push.ts` | VAPID subject default email |
| `services/phone-verification.ts` | SMS verification body |
| `public/sw.js` | Default push notification title (static; see note below) |
| `prisma/seed-demo-users.ts` | Demo story caption text (user-visible seed content) |

---

## Replacement detail by surface

### Navbar & layout
- `components/layout/TopBar.tsx` — `FriendIntro` → `{BRAND.name}`, `FI` → `{BRAND_INITIALS}`

### Page titles & metadata
- `app/layout.tsx` — default title, OG, Twitter, `applicationName`, `appleWebApp.title`
- `app/invite-preview/[token]/page.tsx` — invite preview metadata

### PWA
- `app/manifest.ts` — `name`, `short_name`, `description` from `BRAND`
- `public/sw.js` — default push title `BuddyIntro` (static file; cannot import TS)

### Email
- `services/email-templates/invitation-story.ts` — header, body, subject, plain text
- `services/email.ts` — from-address display name
- `services/invites.ts` — preview text for story invites

### Notifications
- `services/notifications/emitters.ts` — introduction received message
- `services/notifications/notification-email.ts` — “View on …” CTA
- `services/notifications/notification-push.ts` — VAPID mailto default

### SMS
- `services/phone-verification.ts` — OTP SMS body

### Auth & invite flows
- `components/invite/SignupClient.tsx`
- `components/invite/InviteLandingClient.tsx`
- `components/invite/InviteOnboardingShell.tsx`
- `components/invite/InvitePreviewViewer.tsx`

### Legal
- `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/cookies/page.tsx`
- `components/legal/CookieConsentBanner.tsx`

### Empty states & feeds
- `components/feed/FeedList.tsx` — via `COPY.appName`
- Discoveries empty state components use generic copy (no FriendIntro strings)

### Share targets
- `components/discoveries/DiscoveriesFeed.tsx`
- `components/introductions/IntroductionCard.tsx`
- `lib/invite-share.ts`

### Create flow
- `components/stories/StoryUploader.tsx`
- `lib/copy.ts` — step hints, install banner, positioning copy

---

## Intentionally unchanged (infrastructure / DB)

| Location | Reason |
|----------|--------|
| `lib/constants.ts` — `STORAGE_BUCKET` default `friendintro` | Storage bucket name unchanged |
| `prisma/policies.sql` — bucket `friendintro` | RLS policies unchanged |
| `package.json` / `package-lock.json` — `"name": "friendintro"` | Package name unchanged |
| `public/sw.js` — `CACHE = "friendintro-v1"` | Cache key unchanged (not user-facing) |
| Migration file names under `prisma/migrations/` | Migration history unchanged |
| Demo seed emails `user*@friendintro.com` | Demo account addresses unchanged |
| `app/api/account/export/route.ts` — `friendintro-export-*.json` | Export filename unchanged |
| `components/legal/PrivacySettingsPanel.tsx` — `friendintro-data.json` | Download filename unchanged |
| `components/legal/CookieConsentBanner.tsx` — `STORAGE_KEY = "fi_cookie_consent"` | Internal localStorage key |
| `components/pwa/PwaShell.tsx` — `fi-install-dismissed` | Internal localStorage key |

---

## Remaining `FriendIntro` references

### Non–user-facing (dev scripts & docs — left unchanged)

| File | Context |
|------|---------|
| `scripts/health-check.ts` | Console banner |
| `scripts/verify-database.ts` | Console banner |
| `scripts/audit-*.ts` (routes, navigation, database, graph, events, performance) | Console/report titles |
| `README.md` | Project readme title |
| `docs/*.md` (RLS, security, beta, disaster recovery, etc.) | Historical audit docs |
| `database-audit.md` | Doc title |
| `prisma/migrations/README.md` | Migration doc |
| `prisma/seed-demo-users.ts` | File header comment only |

### Internal identifier (not displayed)

| File | Context |
|------|---------|
| `lib/copy.ts` | Key name `joinFriendIntro` (value has no brand string) |

### Static service worker note

| File | Context |
|------|---------|
| `public/sw.js` | Push fallback title hardcoded `BuddyIntro` — must stay in sync with `BRAND.name` manually |

### Legacy domain in env fallbacks (infra, not UI copy)

When `NEXT_PUBLIC_APP_URL`, `EMAIL_FROM`, or `VAPID_SUBJECT` are unset, runtime may still use legacy domains from environment files (`.env`). Set env vars to `buddyintro.com` addresses when DNS is ready.

---

## Verification

Run after changes:

```bash
npx next build
rg "FriendIntro" --glob "*.{ts,tsx,js}" --glob "!scripts/**" --glob "!docs/**"
```

Expected: no user-facing `FriendIntro` in app/components/services/lib (excluding internal key names and comments).

---

## Screenshots

Captured from `npm run dev` (localhost:3000). Authenticated routes (`/discoveries`, `/introductions`, `/maindash`) require login — demo credentials were unavailable in this session.

| File | Route |
|------|-------|
| `docs/screenshots/branding-landing.png` | `/` — landing header, BI monogram, BuddyIntro copy |
| `docs/screenshots/branding-login.png` | `/login` — page title “BuddyIntro — trusted introductions” |
| `docs/screenshots/branding-privacy.png` | `/privacy` — legal copy + “← BuddyIntro” back link |

Additional screenshots also saved under the Cursor temp screenshots folder during capture.
