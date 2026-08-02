# Network Profile

**Sprint:** Performance Reset (READ-ONLY)  
**Generated:** 2026-07-31

---

## Topology

```
Browser (local)
  → Next.js (localhost:3010)
       → Supabase Auth REST (getUser)     ~500–1000 ms observed
       → Supabase Postgres pooler us-east-1 :5432
            connect cold ~2.7 s
            SELECT 1     ~289–416 ms (live)
```

Dev machine → **US East** pooler. Geographic RTT is structural unless DB region or local DB changes (infra — out of scope for app-code sprints).

---

## Live measurements (2026-07-31)

### Postgres pooler

| Metric | ms |
| --- | --- |
| TCP/SSL connect | 2,693 |
| SELECT 1 p50 | 328 |
| SELECT 1 avg | 335 |
| SELECT 1 p95 | 416 |

### Supabase Auth (middleware)

| Request | getUserNetwork / total middleware |
| --- | --- |
| `/home` a96991ce | 555 / **573** |
| `/discoveries` | (authMs header) **689** |
| `/messages` | **1,033** |
| `/profile` | **801** |

### HTTP page (client→Next)

| Page | Status | TTFB |
| --- | --- | --- |
| `/` (browser) | 200 | 2,570 |
| `/home` | 500 | 13,519 (compile + error) |
| `/messages` | 500 | 3,170 |

### Localhost navigation timing (`/`)

| Segment | ms |
| --- | --- |
| DNS | 0 |
| TCP | 1 |
| TLS | 0 |
| TTFB | 2,570 |

Local hop is negligible; delay is **server-side waiting on remote Auth/DB**.

---

## Historical network evidence

| Probe | Result | Source |
| --- | --- | --- |
| TCP pooler | 1,043 ms | Sprint 1 NETWORK_LATENCY_REPORT |
| Auth health REST | 672 ms | Sprint 1 |
| SELECT 1 avg | 455 ms (earlier) / 335 ms (today) | profile-data / live |
| DIRECT_URL vs pooler | Same host | Sprint 1 |

---

## API / static / image latency

| Class | Evidence | Notes |
| --- | --- | --- |
| Authenticated page SSR | Warm `/home` 2.3 s TTFB | Dominated by Auth+DB RTT × queries |
| `/api/messages` | Client after shell | Additional RTT chain post-hydrate |
| `/api/media` | Hist 1.8–5.8 s | Redirect + access checks |
| Static chunks (dev) | main-app 1.3 MB transfer | Local; duration 190 ms once cached warm |
| Fonts | ~48 KB Inter | Minor |

---

## Contribution model

For one warm authenticated `/home` request:

| Network class | Absolute | % of “feels slow” |
| --- | --- | --- |
| Supabase Auth getUser | ~0.5–1.0 s | High (every navigation) |
| Pooler RTT × ~15 Prisma ops | ~3–6 s sequential equivalent; ~2–5 s wall with parallelism | **Dominant** |
| Browser↔Next (localhost) | &lt;50 ms | Negligible |
| Asset download (prod FLJS) | ~100–220 KB | Secondary after TTFB |

**Conclusion:** The network bottleneck is **egress to Supabase (Auth + pooler)**, not the browser’s connection to Next.js.
