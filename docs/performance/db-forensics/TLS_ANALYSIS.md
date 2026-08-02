# TLS_ANALYSIS

Artifacts: `artifacts/tcp-tls.json`, `artifacts/pg-ssl-handshake.json`, `artifacts/pg-ssl-handshake-ok.json`, `artifacts/tcp-hostname-penalty.json`, `artifacts/tcp-per-ip.json`

## Protocol note

PostgreSQL does **not** speak raw TLS on first byte. Correct sequence:

1. TCP connect  
2. SSLRequest (`80877103`)  
3. Server replies `S`  
4. TLS handshake  

Raw `tls.connect` on the socket without SSLRequest failed with `ERR_SSL_WRONG_VERSION_NUMBER` (`tcp-tls.json`) — expected, not a server outage.

## Measured TCP (port 5432)

### Per IP (all healthy)

From `tcp-per-ip.json` — 3 samples each:

| IP | TCP ms (approx) |
|----|-----------------|
| 18.213.155.45 | 293–412 |
| 3.227.209.82 | 302–325 |
| 18.214.78.123 | 286–307 |

No black-holed A record.

### Hostname vs family:4 (smoking gun)

From `tcp-hostname-penalty.json` (median of 5):

| Mode | TCP median ms |
|------|---------------|
| `host` default | **801.644** |
| `host` + `family: 4` | **285.707** |
| `host` + `autoSelectFamily: false` | **296.168** |
| IP direct | **304.948** |

**Happy Eyeballs / autoSelectFamily penalty = 801.644 − 285.707 = 515.937 ms** on every default hostname TCP connect.

Prisma and `pg` use hostname strings → they inherit this Node default.

## SSLRequest + TLS (hostname path)

From `pg-ssl-handshake-ok.json` byHostname medians:

| Stage | Median ms |
|-------|-----------|
| DNS | 3.243 |
| TCP | 831.673 |
| SSLRequest | 297.164 |
| TLS handshake | 307.240 |
| Total to TLS-ready | 1435.942 |

TLS negotiation itself is **~307 ms** (about one RTT-scale exchange on this path), not multi-second.

Cert validation: with `rejectUnauthorized: true`, handshake reached cert check and failed `SELF_SIGNED_CERT_IN_CHAIN` (Supabase chain / local trust store). Timing to that point still captured TLS work (~300 ms). Successful measurement used `rejectUnauthorized: false` (forensics only; app uses its normal SSL settings via Prisma/pg).

## Session reuse

Single-shot handshake probes reported `reused: false` (new sockets each run). Warm query path reuses the already-secured PG connection — no new TLS.

## Contribution to ~3 s cold path

| TLS-related bucket | Median ms |
|--------------------|-----------|
| Happy Eyeballs inside TCP | 515.937 |
| True TCP | 285.707 |
| SSLRequest | 297.164 |
| TLS handshake | 307.240 |
| **Subtotal** | **~1406** |
