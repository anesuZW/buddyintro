# ROOT_CAUSE

## Verdict

The ~3 second `SELECT NOW()` delay is **cold connection establishment** from Zimbabwe → Supabase pooler in **us-east-1**, amplified by **Node.js Happy Eyeballs** on hostname TCP, plus **multiple ~300 ms RTTs** (SSLRequest, TLS, auth, query), plus a **~0.83 s Prisma residual** vs raw `pg`.

SQL execution is **0.032 ms**.

## Budget for cold Prisma path (test-db style)

Reference wall: **2894.260 ms** mean (`test-db-equivalent.json`).

| Rank | Contributor | Measured ms | Source |
|------|-------------|-------------|--------|
| 1 | Prisma residual beyond `pg` connect+query | **829.356** | 2894.260 − 1763.524 − 301.380 |
| 2 | Node Happy Eyeballs (hostname TCP − family4 TCP) | **515.937** | `tcp-hostname-penalty.json` |
| 3 | Auth + startup after TLS (incl. pooler accept) | **327.582** | pg.connect − TLS-ready |
| 4 | TLS handshake | **307.240** | `pg-ssl-handshake-ok.json` |
| 5 | Query dispatch + response (warm RTT; SQL 0.032) | **301.380** | `pg-connect-breakdown.json` |
| 6 | SSLRequest round-trip | **297.164** | `pg-ssl-handshake-ok.json` |
| 7 | True IPv4 TCP connect | **285.707** | `family:4` TCP |
| 8 | DNS lookup | **3.243** | handshake-ok DNS |

**Sum of ranked contributors: 2867.609 ms** (within ~27 ms of 2894.260; residual run noise).

## Compact timeline (same numbers)

```
DNS                              3 ms
TCP IPv4                       286 ms
Happy Eyeballs penalty         516 ms
SSLRequest                     297 ms
TLS                            307 ms
Auth / pooler startup          328 ms
SELECT NOW() RTT               301 ms   (server exec 0.032 ms)
Prisma residual                829 ms
────────────────────────────────────
Total                         ~2894 ms
```

## What it is not

| Hypothesis | Evidence against |
|------------|------------------|
| Slow SQL / Postgres CPU | EXPLAIN Execution Time 0.032 ms |
| Multi-second pooler queue | Post-TLS connect remainder 328 ms |
| DNS | Median ~2–3 ms |
| Session vs transaction port | 5432 vs 6543 connect medians within ~30 ms |
| Bad pooler A record | All three IPs TCP ~286–325 ms |

## Warm vs cold

| Path | Median / mean |
|------|----------------|
| Cold new Prisma client | ~2.9 s |
| Warm same client | ~300 ms |

**~2.6 s of the 3 s is paid only when opening a new connection.**
