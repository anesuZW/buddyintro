# slice(0,20) vs Prisma take:20 Verification

**Generated:** 2026-07-26T18:05:00.000Z

---

## Summary

| Question | Answer | Evidence |
| --- | --- | --- |
| Was original Prisma query ordered? | **No** | STATIC ANALYSIS — no `orderBy` in pre-Sprint 3 queries |
| If ordered: field/direction | N/A | — |
| If NOT ordered: deterministic? | **No** — PostgreSQL row order without ORDER BY is undefined | STATIC ANALYSIS |
| Does slice(0,20) preserve ordering? | Preserves **array order** from Scan A/B; that order is itself **non-deterministic** vs prior DB take:20 | STATIC ANALYSIS |
| Can slice return different records? | **Yes**, when >20 matching rows exist | HYPOTHESIS (see examples) |
| Can recommendation ordering change? | **Yes**, if suggestion pair inputs differ | HYPOTHESIS |
| Can recommendation scores change? | **No** — scoring uses `getSharedIntroducerCountsBulk`; unchanged | STATIC ANALYSIS |
| Can recommendation inputs change? | **Yes** — different 20-row subset changes O(n²) pair scan inputs | HYPOTHESIS |

---

## 1. Original ordering analysis

**STATIC ANALYSIS:** Both pre-Sprint 3 `StoryTag.findMany` calls used `take: 20` with **no `orderBy`**, **no `distinct`**, **no cursor**.

PostgreSQL returns an arbitrary row subset for `LIMIT 20` without `ORDER BY`. The prior implementation was already **non-deterministic** across requests and vacuum/order changes.

---

## 2. Current ordering analysis

**STATIC ANALYSIS:** Scan A/B fetch **all** matching tags (broader filters than original suggestion queries). `slice(0, 20)` takes the first 20 elements of the filtered in-memory array.

Array order = Prisma/Postgres return order of the full scan — still **no explicit sort**.

---

## 3. Proof examples

### Example A — Different subset when >20 published authored tags

**Label:** HYPOTHESIS

| Step | Pre-Sprint 3 (`take:20`) | Sprint 3 (`slice(0,20)`) |
| --- | --- | --- |
| Data | 25 published tags on viewer's stories | Same 25 tags |
| DB returns rows in physical order | Tags `{T1…T20}` (arbitrary) | Full scan returns `{T1…T25}` |
| Suggestion input | 20 tags | `slice` → first 20 of scan array |
| Divergence | If scan order ≠ prior LIMIT order, tags `{T21…T25}` may replace `{T1…T5}` in the 20-slot window | Possible |

**Impact:** Introduction suggestion pairs built from `introducedByViewer` may differ.

---

### Example B — ≤20 rows — identical set size

**Label:** STATIC ANALYSIS

If viewer has ≤20 published authored tags and ≤20 published tags where viewer is tagged, both approaches pass **all** rows to `getIntroductionSuggestions`. Pair candidate set is identical regardless of order (O(n²) scan covers same multiset).

---

### Example C — Trust counts unchanged

**Label:** RUNTIME VERIFIED (unit test)

Unit test confirms `introducedByMeCount` counts **all** published authored tags including null `taggedUserId` — not limited to 20.

```9:19:tests/home-story-context.test.ts
  it("counts introducedByMe including tags without taggedUserId on published stories", () => {
    // introducedByMeCount = 2 (not slice-limited)
```

Trust dashboard numbers do **not** use the 20-row slice.

---

### Example D — Visibility unchanged

**Label:** STATIC ANALYSIS

Visibility prefetch builds **full sets** (`coTagAuthorIds`, `everIntroducedAuthorIds`) from all Scan B rows — no `slice(0,20)`. Story bar visibility decisions unaffected by suggestion slice.

---

## 4. Recommendation pipeline impact

**STATIC ANALYSIS:** `getTrustRecommendations` does not consume `introducedByViewer` / `introducedToViewer`. Trust recommendation IDs/ranking **unchanged** by slice.

**HYPOTHESIS:** `getIntroductionSuggestions` (limit 3 on home) may emit different suggestion IDs if the 20-row input window differs.

---

## 5. Risk classification

| Area | Risk | Label |
| --- | --- | --- |
| Trust stat counts | None | RUNTIME VERIFIED (unit tests) |
| Visibility / Story Bar | None | STATIC ANALYSIS |
| Trust recommendations | None | STATIC ANALYSIS |
| Introduction suggestions | Low — only when >20 tags | HYPOTHESIS |
| Feed ordering | None — feed uses separate ctx fields | STATIC ANALYSIS |

---

## 6. Runtime verification gap

**UNVERIFIED:** Side-by-side suggestion ID comparison for `user1@friendintro.com` was not executed (would require dual code-path run against live DB). See `RECOMMENDATION_STABILITY.md`.
