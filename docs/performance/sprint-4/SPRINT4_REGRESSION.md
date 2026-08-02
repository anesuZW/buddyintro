# Sprint 4 Regression Verification

**Generated:** 2026-07-27

---

## Unit tests

| Suite | Result |
| --- | --- |
| `tests/home-story-context.test.ts` | **3/3 PASS** |
| `tests/home-graph-context.test.ts` | **3/3 PASS** |

Projection helpers verified against Prisma-equivalent sort/filter semantics.

---

## RC1 / RC2

| Suite | Status |
| --- | --- |
| RC1 | **NOT RUN** — server unavailable |
| RC2 | **NOT RUN** — server unavailable |

---

## Behaviour checklist (design review)

| Area | Expected | Implementation |
| --- | --- | --- |
| Story ordering | Unchanged | Same sort keys in projections |
| Recommendation ordering | Unchanged | `pickTrustRecommendationConnections` mirrors Prisma orderBy |
| Trust mutual count | Unchanged | Same sum over targetIds |
| Visibility | Unchanged | Same gate on visible pool |
| Story bar grouping | Unchanged | Same `getStoryBarForViewer` map logic |
| Feed merge sort | Unchanged | Same post+story sort |
| Discoveries ranking | Unchanged | Same enrichment sort |
| Auth | Unchanged | No auth changes |

---

## Rollback

If regression detected: revert Sprint 4 files only; Sprint 2–3 optimisations preserved.
