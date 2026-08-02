# NETWORK_ANALYSIS

Artifacts: `artifacts/network.json`, `artifacts/network-console.log`, `artifacts/tcp-hostname-penalty.json`, `artifacts/pg-reuse-client.json`

## Path under test

```
Workstation (local 10.112.168.55 / Zimbabwe ISP egress observed in traceroute)
        ↓
Multiple regional hops (41.175.x, 41.173.x, 46.17.x, 5.11.x, 195.219.x, …)
        ↓
AWS us-east-1 ELB: pool-tcp-use11-*.elb.us-east-1.amazonaws.com
        ↓
Supabase pooler :5432
```

## Ping (ICMP)

```
Target: aws-1-us-east-1.pooler.supabase.com → 18.213.155.45
Packets: 10 sent, 0 received, 100% loss
```

ICMP is filtered. **Ping RTT is not available.** TCP connect / query RTT used instead.

## Traceroute (Windows `tracert -d -h 20`)

Notable hops (ms, three probes):

| Hop | RTT (representative) | Note |
|-----|----------------------|------|
| 1 | 2–3 ms | Local gateway `10.112.168.168` |
| 2–6 | 17–32 ms | Private/carrier |
| 7 | ~23–31 ms | `41.175.145.178` |
| 8–10 | ~193–280 ms | Exit toward international (`41.173` / `46.17`) |
| 11 | 37–52 ms | Anomalous dip (`41.175.222.219`) |
| 12–14 | ~193–304 ms | `5.11.x`, `195.219.186.182` |
| 15–16 | `*` | Timeout |
| 17 | 297 ms (one probe) | `63.243.137.148` |
| 18–20 | `*` | No reply to destination |

Destination ICMP never answers. Last useful latencies sit in the **~200–300 ms** band — consistent with measured TCP RTT to us-east-1 (~286 ms with `family:4`).

## Application-layer RTT proxies

| Probe | Median ms | Meaning |
|-------|-----------|---------|
| TCP `family:4` | 285.707 | One-way handshake ≈ RTT |
| SSLRequest | 297.164 | ≈ 1 RTT application probe |
| Warm `SELECT NOW()` | 299.830–306.275 | ≈ 1 RTT + negligible SQL |
| TLS handshake | 307.240 | ≈ 1 RTT-scale crypto exchange |

**Regional latency Zimbabwe → us-east-1 ≈ 285–310 ms RTT** (measured via TCP/app, not ICMP).

## Packet loss / jitter / bandwidth

| Metric | Result |
|--------|--------|
| ICMP loss to pooler | 100% (filtered — not path loss) |
| TCP connect success | 100% in all forensics samples |
| Warm query jitter | pg reuse 20: min 279.4, max 344.3, median 299.8 |
| Bandwidth | Not measured (not required to explain 3 s) |

## Which hop contributes most?

From traceroute, latency **jumps into the ~200 ms class around hops 8–10** (leaving local/regional network toward international/AWS path). Final app RTT to us-east-1 settles near **~300 ms**.

That RTT is paid **multiple times** on cold connect (TCP, SSLRequest, TLS, auth, query) — see `ROOT_CAUSE.md`.
