# Discoveries UX Report

**Date:** 2026-05-24  
**Objective:** Upgrade Discoveries into a trust-based ephemeral content experience.

---

## Summary

Discoveries now communicates automatic expiry, encourages return visits, and explains mutual-introduction discovery through hero messaging, per-card expiry badges, trust context lines, enriched empty states, composer copy, analytics, and admin toggles.

---

## A. Discoveries Hero Banner

**Component:** `components/discoveries/DiscoveriesHeroBanner.tsx`

Displayed at the top of the feed when `enableDiscoveriesHeroBanner` is true.

| Element | Copy |
|---------|------|
| Title | Discoveries disappear after {N} hours |
| Subtitle | Share updates with your trusted network. Mutual introductions can discover you through people you already trust. |
| Callout | Check back often — discoveries expire automatically. |

`N` comes from `discoveriesExpiryHours` (defaults to **24**).

**Analytics:** fires `discovery_banner_viewed` on first render.

---

## B. Expiry Indicators

**Component:** `components/discoveries/DiscoveryExpiryBadge.tsx`  
**Logic:** `lib/discovery-ux.ts` → `formatDiscoveryExpiry()`

Every discovery card shows (when `enableDiscoveryExpiryIndicators` is true):

| State | Label |
|-------|-------|
| Active | Expires in X hours |
| Soon | Expires tomorrow / Expires in N min |
| Past expiry | Expired |

Posts always receive an `expiresAt` timestamp on create (default 24h).

---

## C. Trust Context

**Component:** `components/discoveries/DiscoveryTrustContext.tsx`  
**Logic:** `lib/discovery-ux.ts` → `buildDiscoveryTrustContext()`

When `enableDiscoveryTrustContext` is true, cards show lines such as:

- `Visible through 2 mutual introductions`
- `Trusted path: Alice → Bob → You`
- `Visible through your trusted introduction network`

Falls back to legacy badge chips when trust context is disabled.

---

## D. Empty State

**Component:** `components/discoveries/DiscoveriesEmptyState.tsx`

Replaces generic “No discoveries yet” with trust-network messaging and CTAs:

- Make an introduction → `/create-story`
- View your network → `/introductions`

---

## E. Discovery Composer

**Component:** `components/discoveries/DiscoveriesComposer.tsx`

Shows above the textarea:

> Posts disappear automatically after {N} hours.

---

## F. Analytics

| Event | Trigger | Layer |
|-------|---------|-------|
| `discovery_banner_viewed` | Hero banner mounts | Client → `/api/analytics/track` |
| `discovery_created` | Post created | Server (`createDiscoveriesPost`) |
| `discovery_expired` | Post passes `expiresAt` | Server (`trackRecentlyExpiredDiscoveries`) |
| `discovery_opened` | Card enters viewport (40%) | Client → `/api/analytics/track` |

Constants in `lib/analytics-events.ts`.

---

## G. Admin Controls

**UI:** `/maindash` → Discoveries UX panel (`components/admin/DiscoveriesUxAdmin.tsx`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `enableDiscoveriesHeroBanner` | `true` | Top-of-feed hero |
| `enableDiscoveryExpiryIndicators` | `true` | Per-card expiry badges |
| `enableDiscoveryTrustContext` | `true` | Mutual-intro / path lines |

**Migration:** `prisma/migrations/202614_discoveries_ux/`

Also sets `discoveries_expiry_hours = 24` where previously null.

---

## Files created

- `lib/discovery-ux.ts`
- `lib/discoveries-ux-settings.ts`
- `components/discoveries/DiscoveriesHeroBanner.tsx`
- `components/discoveries/DiscoveryExpiryBadge.tsx`
- `components/discoveries/DiscoveryTrustContext.tsx`
- `components/discoveries/DiscoveriesEmptyState.tsx`
- `components/admin/DiscoveriesUxAdmin.tsx`
- `prisma/migrations/202614_discoveries_ux/migration.sql`
- `tests/discovery-ux.test.ts`
- `docs/DISCOVERIES_UX_REPORT.md`

## Files modified

- `prisma/schema.prisma`
- `services/admin.ts`, `services/discoveries.ts`
- `lib/analytics-events.ts`
- `app/(main)/discoveries/page.tsx`
- `components/discoveries/DiscoveriesFeed.tsx`, `DiscoveriesComposer.tsx`
- `app/api/analytics/track/route.ts`, `app/api/admin/settings/route.ts`
- `app/(main)/maindash/page.tsx`
- `scripts/verify-database.ts`

---

## Verification

```bash
npx prisma migrate deploy
npm run build
node --import tsx --test tests/discovery-ux.test.ts
npm run verify-database
```

Manual checks:

1. Open `/discoveries` — hero banner, composer expiry note visible.
2. Create a post — card shows “Expires in X hours” and trust context when graph data exists.
3. Empty feed — trust-network empty state with CTAs.
4. `/maindash` — toggle UX flags and confirm feed updates after refresh.
