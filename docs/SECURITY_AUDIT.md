# FriendIntro Security Audit

**Date:** 2026-05-24  
**Scope:** Authentication, authorization, RLS, API routes, admin routes, uploads, notifications, analytics  
**Method:** Static code review of all 57 API route handlers, Prisma services, Supabase policies, and client upload flows.

---

## Executive Summary

The platform uses **Supabase Auth** for identity and **Prisma (direct Postgres)** for nearly all application reads/writes. Row Level Security (RLS) in Supabase is a **secondary** control (realtime/storage); **application-layer authorization is the primary defense**.

This audit identified **1 Critical**, **8 High**, **6 Medium**, and **5 Low** findings. **All Critical and High findings were remediated** in migration `202611_security_hardening` and accompanying code changes.

---

## Verification Matrix

| Requirement | Status | Notes |
|---|---|---|
| Normal users cannot access admin APIs | **Pass (fixed)** | Admin routes now return `403 JSON` via `requireAdminApi()` |
| Users can only access their own data | **Pass (fixed)** | Notifications scoped by `userId`; account export scoped; profile email removed |
| Users cannot view private introductions | **Pass (fixed)** | Story access unified through `getStoryForViewer()` + category gates |
| Users cannot bypass category restrictions | **Pass (fixed)** | `storyPassesCategoryGate()` enforced on direct story access |
| Users cannot manipulate trust scores | **Pass** | Trust scores only written in `lib/shared-introducers.ts` (server jobs); no client-writable API |

---

## Critical Findings

### C-1: Storage upload path hijacking (Supabase Storage RLS)

**Severity:** Critical  
**Area:** Upload endpoints / Storage RLS  

**Issue:** The `friendintro` storage insert policy only required `authenticated`, not that `auth.uid()` matched the first path segment. A signed-in user could upload files into another user's folder by passing their UUID in `useUpload`.

**Fix applied:**
- Migration `202611_security_hardening` requires `auth.uid()::text = split_part(name, '/', 1)` on insert
- Bucket set to **private** (`public = false`)
- Authenticated media access routed through `/api/media` with authorization checks + signed URLs
- Invite previews receive admin-signed URLs server-side

---

## High Findings

### H-1: Network graph probing between arbitrary users

**Severity:** High  
**Area:** `GET /api/network?users=`  

**Issue:** Any authenticated user could query introduction evidence between two arbitrary user IDs without being part of the pair.

**Fix applied:** `viewerMayQueryNetworkPair()` requires the caller to be one of the queried users. Returns `403` otherwise.

---

### H-2: Profile API email disclosure

**Severity:** High  
**Area:** `GET /api/profile/[id]`  

**Issue:** Returned `email` for any user ID without relationship checks.

**Fix applied:** Email removed from response; block check added.

---

### H-3: Story API weaker than server page visibility

**Severity:** High  
**Area:** `GET /api/stories/[id]`  

**Issue:** API only checked direct tag membership, not co-tag visibility rules used elsewhere. Category restrictions were not enforced on direct access.

**Fix applied:** Route now uses `getStoryForViewer()` which enforces co-tag rules, conversation references, and `storyPassesCategoryGate()`.

---

### H-4: Discovery post IDOR (like / comment / bookmark / share)

**Severity:** High  
**Area:** `/api/discoveries/[id]/*`  

**Issue:** Engagement endpoints did not verify feed visibility (network, blocks, verification gates, category filters).

**Fix applied:** `canViewDiscoveryPost()` enforced in discoveries service before mutations and comment reads.

---

### H-5: Chat context leaked trust graph without authorization

**Severity:** High  
**Area:** `GET /api/messages/[userId]/context`, messages UI  

**Issue:** Trust profiles, connection paths, and story context were returned for arbitrary user pairs without messaging eligibility checks.

**Fix applied:** `canAccessChatContext()` gate (existing thread OR `checkMessagingAllowed()`). Messages page redirects when blocked or unauthorized; story context uses `getStoryForViewer()`.

---

### H-6: User search returned email addresses

**Severity:** High  
**Area:** `GET /api/users/search`  

**Issue:** Search results included full email addresses for all matches.

**Fix applied:** Email removed from API select (email still used internally for matching).

---

### H-7: Public storage bucket exposed all media URLs

**Severity:** High  
**Area:** Supabase Storage / uploads  

**Issue:** Bucket was `public = true`; anyone with a URL could fetch introduction media without authentication.

**Fix applied:** Private bucket + `/api/media` proxy with `canAccessStoragePath()` + signed redirect URLs. Client uploads return proxy paths.

---

### H-8: Admin API returned HTML redirect instead of 403

**Severity:** High  
**Area:** `/api/admin/*`  

**Issue:** `requireAdmin()` redirected non-admins to `/home`, making automated enforcement ambiguous and potentially leaking redirect behavior to API clients.

**Fix applied:** All admin API routes use `requireAdminApi()` returning `401/403 JSON`.

---

## Medium Findings

### M-1: RLS not enabled on newer tables

**Severity:** Medium  
**Area:** RLS  

**Issue:** `policies.sql` covers core tables (users, stories, messages, posts) but not discoveries, notifications, analytics, blocks, `user_connections`, etc.

**Risk:** Low immediate impact because the app uses Prisma with service role/server credentials, not Supabase client for DB access. Direct PostgREST exposure would bypass app authorization.

**Recommendation:** Add RLS policies for all public tables if Supabase Data API is enabled.

---

### M-2: Admin authorization is email-allowlist only

**Severity:** Medium  
**Area:** Authentication / admin  

**Issue:** `ADMIN_EMAILS` env var is the sole admin gate. No role column or MFA requirement.

**Recommendation:** Add `isAdmin` DB flag set only via migration/service role; require step-up auth for destructive admin actions.

---

### M-3: Trust profile visible to any non-blocked user

**Severity:** Medium  
**Area:** `GET /api/trust/[userId]`  

**Issue:** Shared introducers and trust scores are returned for any user pair that isn't blocked, even without network relationship.

**Mitigation applied:** Block check added. Further tightening (require shared introducer or connection) is product-dependent.

---

### M-4: Analytics client metadata unbounded

**Severity:** Medium  
**Area:** `POST /api/analytics/track`  

**Issue:** Client could send large metadata payloads (storage abuse).

**Fix applied:** Metadata JSON capped at 2000 characters.

---

### M-5: Server-side analytics events trusted

**Severity:** Medium  
**Area:** Analytics  

Server-side analytics events are trusted; compromised server code could inflate metrics. Acceptable for current architecture.

---

### M-6: Messages readable if conversation existed before block

**Severity:** Medium  
**Area:** Messages  

Historical messages remain readable after block (common pattern). New messages correctly rejected by `checkMessagingAllowed()`.

**Recommendation:** Document as intentional or hide threads when blocked.

---

## Low Findings

### L-1: `requireUser()` redirects on API routes instead of 401 JSON

**Severity:** Low  
**Area:** Auth  

Non-admin API routes still redirect unauthenticated callers to `/login`.

---

### L-2: Public invite endpoint exposes inviter story media

**Severity:** Low  
**Area:** `GET /api/public/invites/[token]`  

Intentional for onboarding; token acts as capability. Expired/registered invites rejected.

---

### L-3: Admin settings readable by all authenticated users (RLS)

**Severity:** Low  
**Area:** RLS / `admin_settings`  

`select using (true)` in RLS. App exposes settings via server services only.

---

### L-4: Rate limiting is in-memory per instance

**Severity:** Low  
**Area:** `lib/rate-limit.ts`  

Not durable across serverless instances. Adequate for abuse friction, not strong guarantee.

---

### L-5: Trust score writes are server-only

**Severity:** Low  
**Area:** Trust manipulation  

Users cannot write scores; graph refresh jobs recompute from introductions. Admin can grant `trustedUser` via admin API only.

---

## Residual Risk

1. **Prisma bypasses Postgres RLS** — acceptable while all DB access stays server-side; monitor if Supabase Data API is enabled.
2. **Admin email allowlist** — protect `ADMIN_EMAILS` env var aggressively.
3. **Historical messages after block** — product decision documented as Medium finding M-6.
