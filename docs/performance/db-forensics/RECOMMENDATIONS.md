# RECOMMENDATIONS

Based **only** on measured evidence. No application code was changed in this forensics pass.

## 1. Ensure a single long-lived PrismaClient (avoid connect-per-request / per-script)

**Evidence:** Same-client warm median ~304 ms; new-client median ~2936 ms (`repeatability.json`).

| | |
|--|--|
| Expected improvement | **~2600 ms** per operation that currently opens a new client (2936 − 304) |
| Risk | Low if singleton already correct in app; high if serverless spawns new isolates often |
| Complexity | Low (verify `lib` Prisma singleton; scripts should reuse client) |
| Confidence | **99%** |

## 2. Force IPv4 / disable Happy Eyeballs on DB sockets

**Evidence:** hostname default TCP 801.644 ms vs `family:4` 285.707 ms (−515.937 ms).

| | |
|--|--|
| Expected improvement | **~516 ms** per new TCP connection |
| Risk | Medium (must not break IPv6-only environments; this workstation’s `DIRECT_URL` is IPv6-only) |
| Complexity | Medium (Node `net` / undici defaults; Prisma engine may need `localhost` proxy or OS `ipv4first`) |
| Confidence | **95%** for this Node/Windows path |

Possible levers (ops/config, not measured as applied here): `NODE_OPTIONS=--dns-result-order=ipv4first`, OS IPv4 preference, connect via resolved IPv4 (with care for TLS SNI).

## 3. Move database / pooler closer to users (or run app in us-east-1)

**Evidence:** Warm RTT / TCP family4 / SSLRequest / query all ≈ **285–310 ms**. Cold path pays that RTT ~5+ times.

| | |
|--|--|
| Expected improvement | If RTT fell from ~300 ms → ~50 ms: roughly **~1250–1500 ms** off cold connect (5×250 ms) and **~250 ms** off every warm query — *extrapolated from measured RTT counts, not a second-region A/B* |
| Risk | High (migration, latency for other geos, Supabase region availability) |
| Complexity | High |
| Confidence | **80%** on direction; **50%** on exact ms without measuring target region |

## 4. Do not expect port 6543 alone to fix the 3 s

**Evidence:** 6543 connect median 1737.778 vs 5432 1763.524.

| | |
|--|--|
| Expected improvement | **~0–50 ms** (noise) |
| Risk | Medium (transaction mode breaks session features / prepared statements) |
| Complexity | Low–medium |
| Confidence | **90%** that it will **not** remove the 3 s |

## 5. Fix DIRECT_URL reachability before using it as a bypass

**Evidence:** Direct host has no working IPv4 from this network (`dns-direct.json`).

| | |
|--|--|
| Expected improvement | Unknown until IPv4/direct path works and is measured |
| Risk | High if app pointed at unreachable direct URL |
| Complexity | Medium (Supabase network / IPv4 add-on / different network) |
| Confidence | **95%** that direct is currently unusable here |

## 6. Do not optimize SQL for `SELECT NOW()`

**Evidence:** Execution Time 0.032 ms.

| | |
|--|--|
| Expected improvement | **~0 ms** |
| Confidence | **99%** |

## Priority order (impact × confidence)

1. Connection reuse / singleton (largest measured delta)  
2. IPv4 / Happy Eyeballs fix (~0.5 s per connect)  
3. Region proximity (large, needs confirmatory measure)  
4. Pooler mode / SQL tweaks — not the 3 s story  
