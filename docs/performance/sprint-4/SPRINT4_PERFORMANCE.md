# Sprint 4 Performance

**Generated:** 2026-07-27

---

## Query comparison — `/home`

| Metric | Sprint 3 | Sprint 4 | Δ |
| --- | --- | --- | --- |
| StoryTag.findMany | 2 | 2 | 0 |
| Story.findMany | 5 | **4** | **−1** |
| UserConnection.findMany | 2 | **1** | **−1** |
| Total Prisma (est.) | 17 | **~15** | **−2 (~12%)** |

---

## Query comparison — `/discoveries`

| Metric | Sprint 3 (est.) | Sprint 4 | Δ |
| --- | --- | --- | --- |
| UserConnection.findMany | 3 | **1** | **−2** |

---

## Pooler RTT savings (established Sprint 1 model)

| Removed round trip | Est. saved |
| --- | --- |
| 1× Story.findMany | ~300–600 ms |
| 1× UserConnection.findMany (/home) | ~300–600 ms |
| 2× UserConnection.findMany (/discoveries) | ~600–1200 ms |

SQL execution remains fast; savings are round-trip dominated.

---

## HTTP benchmarks

| Session | Status |
| --- | --- |
| Sprint 4 live capture | **BLOCKED** (no dev server) |
| Sprint 3 warm `/home` | TTFB 2,344 ms baseline reference |

Re-run `profile:http-capture` after deployment for measured TTFB delta.

---

## CPU / Memory

Not measured this session.
