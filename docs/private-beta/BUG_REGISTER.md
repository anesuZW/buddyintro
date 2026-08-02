# Private Beta — Bug Register

**Date:** 2026-08-02

| ID | Severity | Area | Summary | Status |
|----|----------|------|---------|--------|
| PB-001 | Critical | Reliability | Empty/HTML 500 on unwrapped high-traffic APIs | **Fixed** — `withApiHandler` on user journeys |
| PB-002 | Critical | Reliability | `error.tsx` showed `error.message` | **Fixed** |
| PB-003 | Critical | Reliability | No `global-error` / locale error | **Fixed** |
| PB-004 | High | Upload | 4xx uploads retried 3× | **Fixed** |
| PB-005 | High | Upload | Content-Length false 413 near limit | **Fixed** (+1 MB slack) |
| PB-006 | High | Upload | Cancel/progress missing in UIs | **Fixed** |
| PB-007 | High | Upload | Orphans never cleaned (media_objects as referenced) | **Fixed** |
| PB-008 | High | UX | Blank nav waits / text-only loading | **Fixed** — skeletons + loading.tsx |
| PB-009 | High | Messaging | Chat switch showed previous thread | **Fixed** |
| PB-010 | High | Messaging | Optimistic + realtime duplicate | **Fixed** |
| PB-011 | High | Messaging | Wrong conversation pagination cursor | **Fixed** |
| PB-012 | Medium | Messaging | Unread while chat open | **Fixed** — `/api/messages/read` |
| PB-013 | Medium | Security | Comment Forbidden → 500 | **Fixed** → 403 |
| PB-014 | Medium | PWA | Push enable vs prefs desync | **Fixed** — PATCH prefs on enable |
| PB-015 | High | Ops | Web push needs VAPID + worker | **Open** — ops |
| PB-016 | Medium | Security | Invalid UUID path params | **Open** |
| PB-017 | Medium | Security | `/api/metrics` unauthenticated | **Open** — nginx |
| PB-018 | Low | Messaging | No typing indicators / read ticks | **Accepted** — not in scope |
| PB-019 | Low | Infra | Zimbabwe→us-east-1 ~3 s cold DB | **Accepted** — forensics; reuse connections |

## Severity guide

- **Critical** — crash, data loss, or blank failure for normal users  
- **High** — broken journey or serious trust/reliability issue  
- **Medium** — incorrect status / degraded UX  
- **Low** — polish / known product gap  
