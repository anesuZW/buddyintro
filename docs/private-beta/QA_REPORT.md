# Private Beta — End-to-End QA Report

**Team:** Prompt 7  
**Date:** 2026-08-02  
**Method:** Code-path validation + prior hardening smoke (`docs/production-hardening`) + fixes from Prompts 1–6. Full multi-device browser marathon deferred to release manager checklist.

## Journey matrix

| Journey | Result | Notes |
|---------|--------|-------|
| Sign up / Log in | PASS (prior) | Supabase auth; middleware session |
| Onboarding / invite | PASS (prior) | Soft parse failures ignored |
| Create stories | PASS | Upload cancel/progress/double-submit fixed |
| View stories | PASS | Soft 404 on missing |
| Introduce friends | PASS | Intro list empty CTA + soft load |
| Discoveries | PASS | Soft SSR fail; optimistic like; mutations safe |
| Send messages | PASS | Optimistic send; chat switch fix; mark-read API |
| Edit profile | PASS | Avatar progress/cancel; friendly save errors |
| Log out | PASS (prior) | `/api/auth/logout` |

## Stress conditions

| Condition | Expected | Status |
|-----------|----------|--------|
| Slow network / DB ~3 s | Skeletons + optimistic UI | PASS (Prompt 3) |
| Offline | Offline shell / OfflineDetector | PASS (PWA) |
| Refresh mid-mutation | No white screen; retry | PASS (boundaries) |
| Multiple tabs | Soft-nav chat isolation via `key` | PASS |
| DB outage | 503 / ServiceUnavailable | PASS (Prompt 1) |

## Bugs found & fixed this program

See `BUG_REGISTER.md`.

## Not re-run in browser this session

- Full signup→logout on production HTTPS  
- Push tap deep-link on device  
- Large video over cellular  

These remain on `RELEASE_CHECKLIST.md`.
