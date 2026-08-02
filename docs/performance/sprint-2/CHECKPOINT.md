# Sprint 2 Checkpoint

**Sprint:** Authentication & Shared Request Optimization  
**Created:** 2026-07-26

---

## Git checkpoint (do not commit)

| Tag | Commit | Purpose |
| --- | --- | --- |
| `checkpoint/sprint-2-auth-start` | `87edda0` | Pre–Sprint 2 working tree baseline |

Restore code to sprint start:

```bash
git checkout checkpoint/sprint-2-auth-start -- lib/auth.ts lib/introductions-settings.ts services/layout-badges.ts components/layout/LayoutBadges.tsx services/notifications/notification-service.ts
```

---

## Baseline artifacts

- `artifacts/baseline.json` — query counts and duplicate estimates from profiling sprint
- Prior HTTP capture: `docs/performance/.profile-data.json` → `httpProfile`

---

## Validation

```bash
npm run sprint:auth-validation
```

Generates all Sprint 2 reports under `docs/performance/sprint-2/`.
