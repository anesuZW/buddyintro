# RC1 Go / No-Go — Final Stabilization

**Date:** 2026-08-02  
**Site:** https://buddyintro.com  
**Code:** `main` through `397f047` (local)  
**Production at decision time:** still `87edda0` — **must deploy before invites**

## Decision

# READY WITH MINOR KNOWN ISSUES

**After deploy of current `main` and checklist smoke.**  
Pre-deploy production remains blocked on Critical/High that are already fixed in git.

## Why this decision

| Was blocking | Now |
|--------------|-----|
| RC1-001 Critical password reset | Fixed in code |
| RC1-002/003 High silent auth errors | Fixed in code |
| RC1-004 High Redis health false alarm | Fixed in code |
| Medium landing / logout / story delete | Fixed in code |
| Authenticated product unproven | Proven in prior QA matrix |

## Minor known issues (accepted)

1. **RC1-007** — QA cannot read PM2 from workstation (ops access).  
2. **RC1-009** — PWA install prompt not device-verified (assets OK).  
3. **Optional Redis** — unset on VPS; fallbacks healthy.  

## Upgrade path to READY FOR PRIVATE BETA (strict)

All of:

1. Deploy `main`  
2. Password-reset email E2E green  
3. Auth error alerts verified on prod  
4. `/api/health` not falsely degraded  
5. Device PWA install smoke (clears RC1-009)  

## Do not invite on current production build

Production commit `87edda0` still lacks password reset and the other Critical/High fixes.  
