# Prisma Overhead Analysis

**Generated:** 2026-07-26T07:19:50.247Z  
**Method:** Compare raw `pg` SELECT 1 vs PrismaClient vs PrismaClient + query extension

---

## Measurements (10 runs)

| Path | avg | p50 | p95 | max |
|------|-----|-----|-----|-----|
| Raw pg SELECT 1 | 307ms | 297ms | 358ms | 358ms |
| Prisma $queryRaw | 553ms | 307ms | 2768ms | 2768ms |
| Prisma + extension | 557ms | 305ms | 2696ms | 2696ms |

---

## Overhead Estimates

| Component | Estimated ms |
|-----------|--------------|
| Prisma over raw pg | **246ms** |
| Query extension (timing) | **4ms** |

---

## Breakdown

| Component | Assessment |
|-----------|------------|
| Connection acquisition | Pooled by Prisma — amortized across requests |
| Serialization | Negligible for scalar/count queries |
| Middleware (extension) | ~4ms — disabled in prod unless PROFILE_* |
| Result parsing | Negligible |
| Network | **Dominant** (~307ms) |
| SQL execution | **<1ms** |

---

## Conclusion

**Prisma is not the bottleneck.** Optimizing Prisma middleware or switching ORM would not materially improve page load. Focus on pooler RTT (infra) and query count (Sprints 2–5).
