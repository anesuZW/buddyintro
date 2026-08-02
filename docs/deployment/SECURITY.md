# Security — Production Hardening Verification

**Date:** 2026-07-26  
**Prior audit:** `docs/SECURITY_AUDIT.md`, RC2 security regression

---

## Headers (verified in code)

| Header | Source | Status |
|--------|--------|--------|
| Content-Security-Policy | `lib/security.ts` middleware | ✅ |
| Strict-Transport-Security | `lib/security.ts` (production only) | ✅ |
| X-Frame-Options | `DENY` — middleware + `next.config.js` | ✅ |
| X-Content-Type-Options | `nosniff` | ✅ |
| Referrer-Policy | `strict-origin-when-cross-origin` | ✅ |
| Permissions-Policy | camera/mic self; notifications self | ✅ |
| X-XSS-Protection | Legacy block mode | ✅ |

Nginx adds duplicate-safe headers — see `docs/deployment/nginx.conf`.

---

## CSRF / origin validation

| Check | Implementation |
|-------|----------------|
| Mutating requests | `validateOrigin()` in `middleware.ts` |
| Upload route | Same-origin + structured 403 JSON |
| `ALLOWED_ORIGINS` | Comma list for multi-domain |

RC2: unauthenticated API returns 401; CSRF prior audit PASS.

---

## Authentication & authorization

| Layer | Mechanism |
|-------|-----------|
| Session | Supabase SSR cookies |
| API routes | `requireUserApi()` / `getCurrentUser()` |
| Admin | `ADMIN_EMAILS` + RBAC tables |
| Rate limiting | `lib/api-rate-limit.ts` on mutations |

---

## Cookies

Supabase auth cookies: httpOnly, secure in production (Supabase SSR defaults).

Invite preview cookies: `secure: production` in `app/api/public/invites/[token]/route.ts`.

---

## Supabase RLS

Policies in `prisma/policies.sql`. Users access only own rows; service role server-side only.

**Never expose `SUPABASE_SERVICE_ROLE_KEY` to client.**

---

## Secret leakage

| Check | Result |
|-------|--------|
| Client bundle | Only `NEXT_PUBLIC_*` vars |
| Server modules | `server-only` package on sensitive imports |
| `.env` in git | `.gitignore` — verify not committed |
| API responses | No raw DB URLs or keys |

---

## Rate limiting

Applied on: stories post, messages post, discoveries mutations, uploads (via auth + size limits).

---

## Upload security

| Control | Status |
|---------|--------|
| Max size 25 MB | App + Nginx `client_max_body_size 26m` |
| Auth required | ✅ |
| CSRF on upload | ✅ |
| Structured 413/403 | `lib/upload-reject.ts` |

---

## Known documented gaps (not launch blockers)

| ID | Issue |
|----|-------|
| QA-004 | Invite token API middleware path — documented |
| Local MIME permissive | Local provider accepts non-image bytes — use S3 in prod if stricter validation needed |

---

## Pre-launch security checklist

- [ ] `ALLOWED_ORIGINS` set to production domain(s)
- [ ] `NEXT_PUBLIC_APP_URL` matches live URL
- [ ] TLS Full (strict) on Cloudflare
- [ ] Service role key rotated if ever exposed
- [ ] Admin emails list reviewed
- [ ] RLS policies applied (`npm run db:rls`)
- [ ] Firewall: only 80/443 public; SSH key-only

---

## No changes required for launch

Security posture from hardening + RC2 sprints is **adequate for beta launch**. Post-launch: tighten CSP (`unsafe-eval` removal) when Next.js config allows.
