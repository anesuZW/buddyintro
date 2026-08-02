# Home Performance Diff

**Generated:** 2026-07-26T16:19:37.723Z

---

## Query counts

| Metric | Before | After | Δ |
| --- | --- | --- | --- |
| StoryTag.findMany | 10 | 2 | −8 |
| StoryTag.count | 2 | 0 | −2 |
| Story.findMany | 5 | 5 | 0 |
| Total Prisma (est.) | 25 | 17 | −8 (−32%) |

---

## HTTP /home

| Metric | Before | After |
| --- | --- | --- |
| TTFB | 6103ms | 2344ms |
| Total | 12591ms | 9246ms |

---

## Estimated pooler savings

~**3050ms** per /home request from eliminated StoryTag round-trips alone (p50 305ms RTT).
