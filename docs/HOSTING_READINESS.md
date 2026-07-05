# Hosting Readiness

Generated: 2026-06-23T07:18:42.260Z

Measured safe concurrency: **25 simultaneous users** (single `next start` instance, auth RTT ~250ms)

Assumption: average session ~8 requests/minute active browsing, 5% of DAU concurrent at peak.

---

## A. Shared hosting + Supabase

| Metric | Estimate |
| ------ | -------- |
| Safe simultaneous | **10–15** |
| Safe DAU | **200–400** |
| Safe MAU | **800–1,500** |
| Registered users | **2,000–5,000** |

Limited by single process, cold starts, and auth RTT to Supabase eu-west-1.

---

## B. Small VPS (2 GB RAM)

| Metric | Estimate |
| ------ | -------- |
| Safe simultaneous | **20–30** |
| Safe DAU | **600–1,000** |
| Safe MAU | **2,500–4,000** |
| Registered users | **8,000–15,000** |

One Node instance; enable Supabase pooler; monitor RSS >1.4 GB.

---

## C. Small VPS (4 GB RAM)

| Metric | Estimate |
| ------ | -------- |
| Safe simultaneous | **40–50** |
| Safe DAU | **1,500–2,500** |
| Safe MAU | **6,000–10,000** |
| Registered users | **25,000–40,000** |

Room for 2 Node workers behind nginx at ~25 VUs each.

---

## D. Vercel + Supabase

| Metric | Estimate |
| ------ | -------- |
| Safe simultaneous | **15–25 per region** |
| Safe DAU | **500–1,200** |
| Safe MAU | **2,000–5,000** |
| Registered users | **10,000–25,000** |

Serverless: auth + DB RTT per invocation; use edge session cache and connection pooler; avoid long SSR chains on Pro without tuning.

*Based on measured throughput ~31.75 RPS plateau and safe VU=25.*
