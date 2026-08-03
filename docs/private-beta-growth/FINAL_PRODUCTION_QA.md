# FINAL PRODUCTION QA — BuddyIntro Private Beta

**Date:** 2026-08-03  
**Branch:** `main`  
**Scope:** Production-quality Private Beta readiness (regression, security, growth funnel, reliability)

---

## Executive recommendation

### READY FOR PRIVATE BETA

**Deploy-gated.** Code is ready after the verified fixes below. Production cutover still requires the operational checklist at the end of this document.

---

## Validation commands

| Command | Result |
|---------|--------|
| `npm run lint` | Pass (0 warnings/errors) |
| `npm run typecheck` | Pass |
| `npm run build` | Pass (`BUILD_EXIT=0`) |

---

## Regression results (summary)

| Area | Result | Notes |
|------|--------|-------|
| Auth (login / callback / `next=`) | **Fixed** | Open redirect blocked; code exchange failures surfaced |
| Password reset / signup paths | Pass (code review) | Reset email uses safe `/reset-password` next |
| Stories image / video / voice | **Fixed** | Dual-media no longer early-advances |
| Story delete / owner controls | Pass | Existing delete control retained |
| Background uploads | **Fixed** | Remote preview URL; cancel race; retry; unload warn |
| Oversize reject before XHR | Pass | Client validation + 100 MB limit |
| Phone invite share (1 number) | Pass | Ready-to-Share reuses invitation phone |
| Personalized invite copy | Pass | Inviter + relationship in `lib/invite-share.ts` |
| OG / link preview | **Fixed** | Preview URLs + host allowlist OG endpoint |
| Invite accept (multi-phone) | **Fixed** | Trigger + app tag attach; **apply SQL on VPS** |
| Discovery feed / like / comment | Pass (code review) | ACL gates present |
| Messaging send/receive | Pass (code review) | Scoped to participant |
| Notifications bell / page | Polish only | Spacing / safe-area |
| PWA share target | **Fixed** | Media → `/share` review with preload |
| Profile / avatar | Pass (code review) | Unchanged |

Full browser-matrix (Safari / Firefox / tablet) was **not** exhaustively executed in this session; critical paths were verified by code audit + build. Device smoke on VPS remains an ops task.

---

## Bugs found & fixed

| ID | Severity | Issue | Fix commit |
|----|----------|-------|------------|
| QA-001 | P0 | Auth `next=` open redirect / phishing | `2cfbc3a` |
| QA-002 | P0 | Invite OG endpoint open redirect via arbitrary `mediaUrl` | `683c23a` |
| QA-003 | High | Ready-to-Share used revoked `blob:` preview | `a7662a0` |
| QA-004 | High | Upload cancel race + no finalize retry | `a7662a0` |
| QA-005 | High | StoryPlayer advanced on shorter of video/voice | `1e3b4b8` |
| QA-006 | High | DB trigger published while phone co-tags pending | `14726eb` |
| QA-007 | P0 | Shared phone beta OTP worked in production | `14726eb` |
| QA-008 | High | Share Target → create-story never attached media | `5c5d49a` |
| QA-009 | P1 | CSRF allowlist empty → fail open in production | `5c5d49a` |
| QA-010 | High | Invite accept did not attach `taggedUserId` (app path) | `345457d` |
| QA-011 | Medium | Generic invite share copy / wrong OG share path | `345457d` |
| QA-012 | Low | Notification panel spacing / safe-area | notification polish commit |

---

## Performance improvements

- Upload Manager: single in-flight XHR; no polling loops; `beforeunload` only when busy.
- StoryPlayer: `requestAnimationFrame` only for media-driven segments; cleaned on unmount.
- OG route: 302 redirect only (no image processing).
- No speculative memoization / bundle splits added.

---

## Security findings

### Fixed
- Open redirects (auth callback, login `next`, OG media)
- Untrusted absolute `mediaUrl` rejection on create
- Signed-URL passthrough of arbitrary https stopped
- Production CSRF fail-closed when allowlist empty
- Production phone beta OTP disabled unless `ALLOW_PHONE_BETA_CODE=1`

### Remaining (accepted for private beta / ops)

| Finding | Severity | Disposition |
|---------|----------|-------------|
| `/uploads/` world-readable on local-disk nginx | Medium | Prefer signed `/api/media` long-term; document for local provider deploys |
| `/api/metrics` + deep `/api/health` unauthenticated | Medium | Protect at nginx (localhost/VPN) before public traffic |
| Upload / phone-SMS rate limits incomplete | Medium | Add redis limits in follow-up sprint |
| Legacy image ACL breadth for `{userId}/image/...` | Low–Med | Path entropy; tighten later |
| Media ownership check on story create (path contains userId) | Medium | Partially mitigated by trusted-host schema; ownership assert still recommended |

---

## Remaining technical debt

1. True resume-after-refresh for background uploads (IDB currently write-mostly).  
2. StoryUploader remote-URL prefill for Share → Introduction (Discoveries path works today).  
3. Durable OG JPEG renderer (instead of redirect to signed media).  
4. Wire `auth:login` rate-limit key that exists but is unused.  
5. Exhaustive Safari/iOS PWA device matrix.

---

## Remaining operational tasks (deploy gates)

- [ ] Apply `prisma/migrations/20260803_phone_aware_story_publish/migration.sql` (or reload `policies_v2.sql` functions) on production Postgres  
- [ ] Ensure nginx `client_max_body_size 101m` (100 MB app limit)  
- [ ] Confirm `NEXT_PUBLIC_APP_URL=https://buddyintro.com` and `ALLOWED_ORIGINS` set  
- [ ] Confirm `PHONE_VERIFICATION_BETA_CODE` unset **or** `ALLOW_PHONE_BETA_CODE` not set in prod  
- [ ] Nginx-restrict `/api/metrics` and verbose health  
- [ ] Smoke: WhatsApp invite preview, background intro upload, invite accept with two phone tags  
- [ ] Do **not** push until product owner requests deploy  

---

## Risk assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Phone co-tag publish bug still live until SQL applied | **High until ops** | Migration file committed; must run on VPS |
| 100 MB uploads 413 without nginx update | Medium | Template updated; VPS reload required |
| CSRF fail-closed breaks clients if `ALLOWED_ORIGINS` missing | Medium | Set env before deploy |
| Incomplete device QA | Medium | Private beta cohort + rapid hotfix channel |

---

## Final recommendation

**READY FOR PRIVATE BETA** — with deploy gates above.

Do not invite external users until:

1. Phone-aware publish SQL is applied, and  
2. Nginx body size + origin allowlist are confirmed on the VPS.
