# Optimization Roadmap

Generated: 2026-06-23T07:18:42.260Z

Ranked by ROI (impact × effort⁻¹). Expected gains are directional from measured baselines.

---

## P0 — Do before launch

| Item | Expected gain | Notes |
| ---- | ------------- | ----- |
| **Auth: local JWT verify / session cache** | **−200–250ms p50** on every route | Measured middleware auth 524ms; 70%+ of TTFB |
| **Exclude health/static from middleware auth** | **−250ms** on probes & assets | Safe for `/api/health`, manifest, icons |
| **Supabase pooler + raise connection_limit** | **−30–50% p95** @ 50+ VUs | Queueing under parallel Prisma |

---

## P1 — High value

| Item | Expected gain | Notes |
| ---- | ------------- | ----- |
| Batch trust profile lookups (discoveries) | **−100–300ms** discoveries SSR | N+1 in trust enrichment |
| Message context: keep fast path only | **−50–2000ms** under load | Sequential 119ms → concurrent 2000ms+ |
| Horizontal scale (2× Node + sticky sessions) | **2× safe VUs** | Breaking point @ 100 VUs single process |
| Redis/edge cache for public discovery pages | **−40% DB load** | Per-user feed still dynamic |

---

## P2 — Medium

| Item | Expected gain | Notes |
| ---- | ------------- | ----- |
| Introduction suggestions batch counts | **−200ms** profile/home | O(n²) queries |
| Category visibility precompute | **−50–150ms** discoveries | Per-post queries |
| SSR streaming / defer non-critical panels | **−100ms TTFB** | Home trust dashboard |
| Cursor pagination messages/inbox | **Prevents O(n) blowup** | Long-term scale |

---

## P3 — Lower priority

| Item | Expected gain | Notes |
| ---- | ------------- | ----- |
| Materialized feed table | **Major at 10k+ users** | Not needed for beta |
| Read replicas | **2× read capacity** | After DB becomes bottleneck |
| CDN for media | **−latency** | Storage signed URLs already |

---

## Memory / stability

Verdict: **stable** — Memory within expected variance for sustained load (post-warmup)

Crash class: **access-violation** — prioritize process stability before 100+ VU targets.
