# POOLER_ANALYSIS

Artifacts: `artifacts/url-inspect.json`, `artifacts/pg-port-5432.json`, `artifacts/pg-port-6543.json`, `artifacts/pg-connect-breakdown.json`, `artifacts/pg-new-client.json`

## Configuration facts

| Item | Value |
|------|-------|
| `DATABASE_URL` host | `aws-1-us-east-1.pooler.supabase.com` |
| Port in use | **5432** |
| URL `?pgbouncer=` | **absent** |
| Pooler hostname | **yes** (`*.pooler.supabase.com`) |
| `DIRECT_URL` | `db.<ref>.supabase.co:5432` |

Supabase convention (documented by Supabase; confirmed by hostname/port pairing):

- **5432** on pooler host → session mode  
- **6543** on pooler host → transaction mode  

## Mode comparison (measured)

Same credentials/host, only port changed.

| Port | Connect median | Warm query median | n | Result |
|------|----------------|-------------------|---|--------|
| 5432 (from URL / explicit) | 1763.524 ms | 301.380 ms | 5 | OK |
| 6543 | 1737.778 ms | 300.296 ms | 3 | OK |

**No meaningful connect or query difference** between 5432 and 6543 in this probe set (~30–50 ms, within noise).

## Prepared statements / pool limits

Not directly instrumented (would require pooler admin metrics). Observable client behavior:

- Warm reuse works on a single `pg` / Prisma client → pooler accepts persistent session connections on 5432.
- Many parallel new Prisma clients → per-client times rise to 5.3–5.6 s (`repeatability.json`), consistent with contention at client or pooler under burst connect load.

## Connection reuse

| Client pattern | Connect paid every time? | Evidence |
|----------------|--------------------------|----------|
| New `pg.Client` each run | Yes — connect median ~1848 ms (`pg-new-client.json`) | Measured |
| One `pg.Client`, 10 queries | Connect once (1801 ms), queries ~288–398 ms | Measured |
| New `PrismaClient` each run | Yes — ~2.7–3.2 s per cycle | Measured |
| One `PrismaClient` | Connect on first query only | Measured |

## DIRECT_URL from this workstation

`artifacts/dns-direct.json`:

- IPv4 `lookup` / `resolve4`: **ENOTFOUND / ENODATA**
- IPv6 address present via `resolve6`

Direct DB hostname is **not usable over IPv4** from this network path. Pooler (IPv4 A records) is the working path.

## Pooler wait hypothesis

A multi-second “pooler queue wait” was **not** observed as a single stage.

After TLS-ready, remaining time inside `pg.connect` is **327.582 ms** median (`pg-ssl-derived.json`). That bucket includes auth + whatever pooler/server startup work remains — **not** ~2 s.
