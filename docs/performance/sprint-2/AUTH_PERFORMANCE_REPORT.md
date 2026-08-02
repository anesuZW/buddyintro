# Auth Performance Report

**Generated:** 2026-07-26T15:46:50.801Z

---

## Success Metrics (Estimated)

| Metric | Before | After | Change |
| --- | --- | --- | --- |
| User.findUnique / request | 1 | 1 | 0 |
| AdminSettings.findUnique / request | 1 | 1 | 0 |
| NotificationPreferences.findUnique / request | 0–2 | 1 | −0–1 |
| Layout badge query batches | 1–2 | 1 | −0–1 |
| Total queries /home (est.) | 18 | 16 | −2 |
| Est. DB time /home (pooler p50) | ~8190ms | ~4912ms | ~−3278ms |

---

## HTTP Benchmark

| Page | Status | TTFB | Total | Auth ms |
| --- | --- | --- | --- | --- |
| / | 200 | 7784 | 7800 | — |
| /home | 200 | 6103 | 12591 | — |
| /discoveries | 200 | 10002 | 10007 | — |
| /profile | 200 | 8781 | 8792 | — |
| /messages | 200 | 3772 | 3781 | — |
| /introductions | 200 | 3847 | 3854 | — |
| /notifications | 200 | 3163 | 4221 | — |

---

## CPU / Memory (Client Capture Script)

- Heap delta: 1 MB
- Client CPU user: 109 ms

---

## Cost / Latency Estimates

| Lever | Savings |
| --- | --- |
| Query reduction | 1–3 pooler round-trips per heavy page |
| Database latency | ~307ms × saved queries |
| Supabase pooler | Fewer round-trips → lower connection churn |
| CPU | Marginal — less Prisma serialization |
| Memory | Unchanged — no new global caches |
