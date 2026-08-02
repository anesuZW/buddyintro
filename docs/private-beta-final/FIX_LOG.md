# Fix Log — Private Beta Final Stabilization

**Date:** 2026-08-02  
**Branch:** `main`  
**Deploy:** Not performed in this pass (operator must deploy before invites)

---

## Commits

| Commit | Issues | Summary |
|--------|--------|---------|
| `22d95fb` | RC1-001…004 | Password reset, durable auth errors, optional Redis health semantics |
| `e232775` | RC1-005 | Remove duplicate landing hero band; header CTA → “Sign up” |
| `4b70830` | RC1-008 | Signup submit idle label → “Create account” |
| `925d4df` | RC1-010 | Profile logout block `pb-10` clears fixed bottom nav |
| `397f047` | RC1-011 | Story player Delete for owners via existing DELETE API |

---

## Per-issue notes

### RC1-001…004 (Critical/High)
See `CRITICAL_FIXES.md`. Root causes and files documented there.

### RC1-005 Medium — Landing duplicate CTAs
- **Root cause:** Upper value-prop band restated the brand hero; header + hero both used long marketing CTA.  
- **Fix:** Removed upper band; header label shortened to “Sign up”; hero CTA unchanged.  
- **Regression:** Landing still shows brand hero + Log in + primary CTA.

### RC1-008 Low — Signup button copy
- **Root cause:** Submit button always used `COPY.startTrustedNetwork`.  
- **Fix:** Idle label “Create account”; loading already “Creating account…”.  
- **Regression:** Invite signup H1 marketing copy unchanged (intentional).

### RC1-010 Medium — Bottom nav tap intercept
- **Root cause:** Mid-scroll Log out sat under fixed `z-30` nav despite global `pb-nav`.  
- **Fix:** Extra `pb-10` on logout wrapper only.  
- **Regression:** Other profile sections unchanged.

### RC1-011 Medium — Story delete UI
- **Root cause:** DELETE API existed; player had no owner affordance.  
- **Fix:** Trash control when `story.userId === currentUserId`; confirm → DELETE → advance/close.  
- **Regression:** Non-owners unchanged; playback/tag UI preserved.

### RC1-012 Low — aria-labels
- **Evaluation:** Source already has `aria-label` on like/comment/share/bookmark (`DiscoveriesFeed.tsx`). Prod DOM null = stale deploy.  
- **Action:** No code change; closed after deploy verification.

### RC1-007 Medium — QA cannot see PM2 logs
- **Evaluation:** Infrastructure/access. App cannot safely expose production logs to browser QA.  
- **Action:** Documented accepted; provide SSH/log export for future RC.

### RC1-009 Low — PWA install not device-verified
- **Evaluation:** Manifest + active SW verified in browser; Chromium BIP needs installability criteria on a real device.  
- **Action:** Accepted for private beta; checklist item for device smoke.

---

## STOP / not changed

- Prisma schema, auth architecture, trust/recommendations  
- Setting production `REDIS_URL` (ops)  
- Deploy/restart PM2 (operator)  
