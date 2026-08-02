# CONNECTION_TIMELINE

All values are **measured** (hrtime / `performance.now`).  
Primary cold-path target: Prisma `SELECT NOW()` equivalent to `test-db.js`.

## Reproduced cold path (test-db equivalent)

Source: `artifacts/test-db-equivalent.json`

| Run | ms |
|-----|-----|
| 1 | 3091.636 |
| 2 | 2773.576 |
| 3 | 2684.872 |
| 4 | 2692.877 |
| 5 | 3228.337 |
| **Mean** | **2894.260** |
| Median | 2773.576 |

Matches the CTO baseline (~3.07 s) within run-to-run variance.

## Stage timeline (hostname path — what Prisma/pg use)

Medians unless noted. Sources: `pg-ssl-handshake-ok.json`, `pg-connect-breakdown.json`, `tcp-hostname-penalty.json`, `explain.json`, `test-db-equivalent.json`.

```
DNS lookup                         3.243 ms
TCP connect (Node default host)  801.644 ms   ← includes Happy Eyeballs
  of which true IPv4 TCP         285.707 ms   (family:4 control)
  of which Happy Eyeballs wait   515.937 ms   (801.644 − 285.707)
SSLRequest round-trip            297.164 ms
TLS handshake                    307.240 ms
── subtotal to TLS-ready ────── 1435.942 ms   (handshake-ok hostname total)
Auth + startup after TLS         327.582 ms   (pg.connect 1763.524 − 1435.942)
── pg.Client.connect ────────── 1763.524 ms
Warm SELECT NOW() RTT            301.380 ms   (reuse client; SQL exec 0.032 ms)
── pg connect + query ───────── 2064.904 ms
Prisma residual                  829.356 ms   (test-db mean 2894.260 − 2064.904)
── Prisma cold SELECT NOW() ─── 2894.260 ms
```

## What each stage means

| Stage | Includes | Does not include |
|-------|----------|------------------|
| DNS | Resolver answer for pooler host | TCP |
| TCP default | SYN/ACK **plus** Node `autoSelectFamily` delay | TLS |
| SSLRequest | 8-byte PG SSL probe + server `S` | TLS records |
| TLS | Negotiation to secure socket ready | PG Startup/auth |
| Auth/startup | Everything inside `pg.connect` after TLS-ready | First user query |
| Warm query | Client→server→client for `SELECT NOW()` | New TCP/TLS |
| Prisma residual | Measured wall beyond `pg` connect+query on same URL | Not attributed further without engine traces |

## Warm path (connection already open)

Source: `artifacts/pg-reuse-client.json`, `artifacts/repeatability.json`

| Metric | Median ms |
|--------|-----------|
| pg reuse `SELECT NOW()` (10 then 20 samples) | 306.275 / 299.830 |
| Prisma same-client after first (excl. cold outlier) | ~286–327 |

Cold → warm drop: **~2894 ms → ~300 ms**.

## Scripts

- `scripts/run-forensics.mjs`
- `scripts/measure-pg-ssl.mjs`
- `scripts/measure-tcp-hostname-penalty.mjs`
- `scripts/reproduce-test-db.mjs`
