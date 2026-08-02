# Recommendation Stability Verification

**Generated:** 2026-07-26T18:05:00.000Z

---

## Trust recommendations (`getTrustRecommendations`)

| Comparison | Result | Evidence |
| --- | --- | --- |
| Code path changed? | **No** | STATIC ANALYSIS — file unchanged |
| Query changed? | **No** | Same `UserConnection.findMany` |
| Ranking algorithm | **Unchanged** | `sharedIntroducerCount desc`, `trustScore desc` |
| IDs deterministic? | **Yes** (given same DB state) | `id: shared-${targetUserId}` |

**Verdict:** Trust recommendation IDs and ranking **stable** for Sprint 3. **Confidence: HIGH** (STATIC ANALYSIS).

---

## Introduction suggestions (`getIntroductionSuggestions`)

| Comparison | Result | Evidence |
| --- | --- | --- |
| Algorithm changed? | **No** | STATIC ANALYSIS |
| Input source changed? | **Yes** — context rows from `slice(0,20)` vs DB `take:20` | Git diff |
| Side-by-side ID comparison | **UNVERIFIED** | Not executed |

### Expected stability conditions

| Condition | Stable? | Label |
| --- | --- | --- |
| Viewer has ≤20 published authored tags AND ≤20 published tagged tags | **Yes** | STATIC ANALYSIS |
| Viewer has >20 tags in either set | **May diverge** | HYPOTHESIS |
| Trust scores in suggestions | **Unchanged** — bulk count map | STATIC ANALYSIS |
| Visibility decisions | **Unchanged** — separate code path | STATIC ANALYSIS |

---

## Side-by-side comparison (UNVERIFIED)

| Field | Original (pre-Sprint 3) | Current (Sprint 3) |
| --- | --- | --- |
| Recommendation IDs | Not captured | Not captured |
| Recommendation ranking | Not captured | Not captured |
| Suggestion IDs | Not captured | Not captured |
| Trust scores | Not captured | Not captured |
| Story IDs (feed/bar) | Not captured | Not captured |

**Blocked:** Dual-path runtime snapshot requires read-only comparison script against live DB with both implementations — not run this audit.

---

## First divergence scenario (HYPOTHESIS)

If `user1@friendintro.com` has >20 published authored tags:

1. Pre-Sprint 3: DB returns arbitrary 20 rows via `LIMIT 20`
2. Sprint 3: Full scan → filter published → `slice(0, 20)` in Prisma return order
3. Different tag sets → different pair candidates → first suggestion ID may differ at index 0

**Proof status:** HYPOTHESIS — not runtime verified.

---

## Why trust/visibility remain stable

| Pipeline | Reason |
| --- | --- |
| Trust stats | Uses full counts from scans, not 20-row slice |
| Visibility | Uses full `Set`s from all tagged rows |
| Story bar | Uses `Story.findMany` + visibility gate — unchanged |
| Feed | Uses `myTaggedUserIds` / `coTagAuthorIds` from full scans |

See `SLICE_VS_TAKE_VERIFICATION.md`.

---

## Conclusion

| Area | Stable? | Confidence |
| --- | --- | --- |
| Trust recommendations | Yes | HIGH (STATIC ANALYSIS) |
| Introduction suggestions | Conditional | MEDIUM (STATIC ANALYSIS) |
| Live ID proof | **UNVERIFIED** | BLOCKED |
