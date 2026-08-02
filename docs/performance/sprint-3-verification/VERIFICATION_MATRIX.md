# Verification Matrix

**Generated:** 2026-07-26T18:05:00.000Z

| Item | Conclusion | Evidence | Confidence | Verified | Blocked |
| --- | --- | --- | --- | --- | --- |
| Sprint 3 git scope (6 files) | 6 core files changed | Git diff | HIGH | ✓ | |
| StoryTag.findMany = 2 on /home | Consolidation works | Runtime slow log | HIGH | ✓ | |
| StoryTag.count = 0 on /home | Trust bypass works | Runtime trace | HIGH | ✓ | |
| Story.findMany = 5 on /home | Target missed | Runtime trace | HIGH | ✓ | |
| 32% total query reduction | 25 → 17 | Static + runtime | HIGH | ✓ | |
| React cache dedupes context | 2 scans not 6 | Runtime count | HIGH | ✓ | |
| Visibility prefetch skips 2 StoryTag | No visibility StoryTag in trace | Runtime + static | HIGH | ✓ | |
| Trust count semantics preserved | Unit tests 3/3 | Unit tests | HIGH | ✓ | |
| Auth dedupe (Sprint 2) intact | duplicateAuth=no | Auth profile log | HIGH | ✓ | |
| slice vs take:20 risk | Conditional if >20 tags | Static analysis | MEDIUM | Partial | |
| Trust recommendation stability | Unchanged code | Static analysis | HIGH | ✓ | |
| Introduction suggestion IDs | Not diffed | — | LOW | | ✓ |
| Per-query SQL text | Not captured | Instrumentation gap | — | | ✓ |
| Per-query row counts | Not captured | Instrumentation gap | — | | ✓ |
| Per-query caller (runtime) | Mapped from static graph | Static + log order | MEDIUM | Partial | |
| Live EXPLAIN on new scans | Script DB failure | profile:database error | LOW | | ✓ |
| RC1 / RC2 | Not re-run | — | — | | ✓ |
| HTTP A/B vs Sprint 2 | Cold compile invalidates | HTTP capture | MEDIUM | Partial | |
| Warm HTTP improvement | TTFB 6103→2344ms | Historical session | LOW | Partial | |
| Pooler dominates latency | p95 3109ms SELECT 1 | check-db-latency | HIGH | ✓ | |
| No StoryTag duplicates remain | 0 duplicates | Runtime + static | HIGH | ✓ | |
| Email delivery changes in stories.ts | Out of Sprint 3 scope | Git diff | HIGH | ✓ | |

**Confidence key:** HIGH = runtime verified; MEDIUM = static + inspection; LOW = historical only; HYPOTHESIS excluded from this matrix.
