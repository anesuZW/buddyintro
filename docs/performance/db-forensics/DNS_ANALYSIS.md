# DNS_ANALYSIS

Artifact: `artifacts/dns.json`, `artifacts/dns-direct.json`, `artifacts/tcp-hostname-penalty.json`

## Pooler host: `aws-1-us-east-1.pooler.supabase.com`

### Resolved addresses

| Family | Result |
|--------|--------|
| A (IPv4) | `18.214.78.123`, `18.213.155.45`, `3.227.209.82` (ELB CNAME target) |
| AAAA (IPv6) via `dns.lookup(..., family:6)` | **ENOTFOUND** |
| `dns.lookup({ all: true })` | IPv4 only (3 addresses) |

### Timing (ms)

| Method | n | min | median | max | mean |
|--------|---|-----|--------|-----|------|
| `lookup` family 4 | 8 | 1.209 | **1.780** | 108.446 | 15.244 |
| `resolve4` | 8 | 6.486 | 16.422 | 64.889 | 26.122 |
| `resolve6` | 8 | 8.172 | 27.545 | 59.355 | 29.481 |

Cold `lookup4` can spike to ~108 ms; steady-state is **1–4 ms**.

`getaddrinfo` all/verbatim (hostname penalty script): small (same order as lookup).

## Direct host: `db.drzpgydqpryrwobtqbkg.supabase.co`

| Probe | Result |
|-------|--------|
| IPv4 | **ENOTFOUND / ENODATA** |
| IPv6 | `2600:1f18:6f7d:e805:fd48:d35c:2ecc:dd39` |
| `resolve6` median | 13.844 ms |

## Does DNS explain the 3 seconds?

**No.** Median DNS is **~2–3 ms**. Even the worst measured lookup (~114 ms) is <4% of a 3 s cold query.

## Important related finding (not DNS answer time)

Node `net.connect({ host })` **default** is ~802 ms TCP, while `net.connect({ host, family: 4 })` is ~286 ms — see `TLS_ANALYSIS.md` / `tcp-hostname-penalty.json`. That delay is **Happy Eyeballs / address selection**, not slow DNS responses.
