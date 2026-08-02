# Sprint 5A Performance

**Generated:** 2026-07-27

---

## Story.findMany — Sprint 4 baseline (no Sprint 5A change)

| Metric | Sprint 3 | Sprint 4 | Sprint 5A |
| --- | --- | --- | --- |
| Count on `/home` | 5 | **4** | **4** |
| Co-tag feed query | 1 DB query | 0 (projection) | 0 |

---

## Total `/home` Prisma (static)

| Sprint | Total est. |
| --- | --- |
| Sprint 3 | 17 |
| Sprint 4 | ~15 |
| Sprint 5A | ~15 (unchanged) |

---

## Theoretical Sprint 5B (trust merge only)

| Metric | Current | If Q1+Q2 merged |
| --- | --- | --- |
| Story.findMany | 4 | **3** |
| Pooler savings (sequential) | — | ~300–600 ms |
| Pooler savings (parallel Suspense) | — | **~0–300 ms** (Q1∥Q2 already) |

---

## Live HTTP / DB benchmarks

| Capture | Status |
| --- | --- |
| Sprint 5A session | **BLOCKED** |
| Sprint 3 warm `/home` TTFB | 2,344 ms (reference) |

---

## CPU / Memory

Not measured. Visible pool is largest memory consumer (full tag includes, unbounded rows).

---

## Conclusion

Sprint 5A produces **no performance delta**. Further Story consolidation requires Sprint 5B implementation with live A/B proof.
