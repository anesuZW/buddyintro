# Capacity Limit Report

Generated: 2026-06-23T07:18:42.260Z

Progressive journey load · 300s per level · Stop if error rate >30%

_Note: Levels 10/25/50/100 include merged data from prior route + journey concurrency runs where applicable._

---

## Results by concurrency

| VUs | RPS | p50 | p95 | p99 | Err% | Peak heap | Peak RSS | Peak CPU | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 25.68 | 339 | 527 | 874 | 0.00% | 0 MB | 0 MB | 0% | OK |
| 25 | 12.56 | 338 | 448 | 697 | 0.00% | 0 MB | 0 MB | 0% | OK |
| 50 | 22.41 | 362 | 2709 | 5132 | 20.25% | 0 MB | 0 MB | 0% | OK |
| 100 | 60.42 | 6 | 12 | 34 | 100.00% | 0 MB | 0 MB | 0% | STOP (error rate 100.0% (prior journey run)) |

---

## Capacity zones

| Zone | Concurrency | Evidence |
| ---- | ----------- | -------- |
| **Safe** | **≤25 VUs** | Error rate ≤1%, p95 within auth-bound budget |
| **Warning** | **25–50 VUs** | Rising p95, occasional journey errors |
| **Breaking point** | **100 VUs** | Error rate >30% or Node crash |

Escalation stopped at **100 VUs**.

*Raw: `docs/.load-investigation-results.json` → `capacity`*
