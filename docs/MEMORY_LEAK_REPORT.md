# Memory Leak Report

Generated: 2026-06-23T07:18:42.260Z

---

## Test configuration

| Setting | Value |
| ------- | ----- |
| Concurrency | 25 VUs |
| Duration | 30 min (1800s) |
| Snapshots | 13 @ 5s |

Expected ~360 snapshots; lower counts indicate intermittent `/api/bench/runtime` polling under load.

---

## Results

| Metric | Start | End | Growth | Growth % |
| ------ | ----- | --- | ------ | -------- |
| Heap used | 77.9 MB | 125.4 MB | 47.5 MB | 61% |
| RSS | 122 MB | 299.1 MB | 177.1 MB | 145.2% |

| Slope | Value |
| ----- | ----- |
| Heap | -134.9 MB/hour |
| RSS | -74.6 MB/hour |

---

## Verdict: **STABLE**

- Memory within expected variance for sustained load (post-warmup)

---

## Interpretation

| Verdict | Criteria |
| ------- | -------- |
| **stable** | Heap/RSS growth within normal GC variance |
| **slow-leak** | Sustained upward slope >25 MB/hour RSS or >40 MB heap |
| **severe-leak** | >80 MB/hour RSS or >150 MB heap over window |

GC pause times are not directly instrumented in-process; heap slope is the primary signal. Enable `--heapsnapshot-near-heap-limit` in staging if verdict is slow/severe.

*Raw: `docs/.load-investigation-results.json` → `memoryLeak`*
