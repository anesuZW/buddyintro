# Introductions Navigation Fix Report

Generated: 2026-06-17T20:31:54.422Z

## Root cause

Three Trust Network cards linked to `/introductions/network?users={singleUserId}`.
The network page requires **two** user IDs and called `notFound()` when only one was provided → **404**.

## Trust Network card audit (runtime targets)

| Card | Component | href | Route | Page file | Status |
|------|-----------|------|-------|-----------|--------|
| Introduction Network | `components/introductions/IntroductionNetworkPanel.tsx` | `/introductions#introductions-list` | `/introductions` | `app\(main)\introductions\page.tsx` | OK |
| Mutual Introductions | `components/introductions/IntroductionNetworkPanel.tsx` | `/introductions/mutual` | `/introductions/mutual` | `app\(main)\introductions\mutual\page.tsx` | OK |
| People Connected Through You | `components/introductions/IntroductionNetworkPanel.tsx` | `/introductions/sent` | `/introductions/sent` | `app\(main)\introductions\sent\page.tsx` | OK |
| People Connected To You | `components/introductions/IntroductionNetworkPanel.tsx` | `/introductions` | `/introductions` | `app\(main)\introductions\page.tsx` | OK |
| Connection Paths | `components/introductions/IntroductionNetworkPanel.tsx` | `/discoveries` | `/discoveries` | `app\(main)\discoveries\page.tsx` | OK |

## Fixes applied

| Card | Was | Now | Verified destination |
|------|-----|-----|----------------------|
| Introduction Network | `/introductions` (no scroll) | `/introductions#introductions-list` | `app/(main)/introductions/page.tsx` |
| Mutual Introductions | `/introductions/network?users={id}` (**404**) | `/introductions/mutual` | `app/(main)/introductions/mutual/page.tsx` |
| People Connected Through You | `/introductions/network?users={id}` (**404**) | `/introductions/sent` | `app/(main)/introductions/sent/page.tsx` |
| People Connected To You | `/introductions/network?users={id}` (**404**) | `/introductions` | `app/(main)/introductions/page.tsx` |
| Connection Paths | `/discoveries` | `/discoveries` (unchanged) | `app/(main)/discoveries/page.tsx` |

Additional hardening:

- `/introductions/network` redirects to `/introductions` when fewer than two user IDs (no more 404).
- Mutual partner cards link to `/introductions/network?users={viewer},{other}` (valid pair).
- Single source of truth: `lib/introduction-routes.ts` → `TRUST_NETWORK_CARDS`.

## Verification

```bash
npm run audit:navigation
npm run build
```
