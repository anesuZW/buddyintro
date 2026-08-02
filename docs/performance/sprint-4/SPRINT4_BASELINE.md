# Sprint 4 Baseline

**Generated:** 2026-07-27  
**Checkpoint:** `checkpoint/sprint-4-start` @ `87edda0`  
**Evidence:** Sprint 3 verification audit (`docs/performance/sprint-3-verification/`)

---

## Pre-Sprint 4 — `/home` (Sprint 3 end state)

| Metric | Value | Source |
| --- | --- | --- |
| StoryTag.findMany | 2 | RUNTIME VERIFIED (Sprint 3) |
| Story.findMany | **5** | RUNTIME VERIFIED |
| UserConnection.findMany | **2** | RUNTIME VERIFIED |
| UserConnection.findFirst | 1 | Materialization probe |
| SharedIntroducerRelationship.groupBy | 1 | Introduction suggestions |
| Post.findMany | 1 | Mutual feed |
| Total Prisma (est.) | **17** | Static + runtime |

### Sprint 3 `/home` HTTP (warm session)

| Metric | Value |
| --- | --- |
| TTFB | 2,344 ms |
| Total | 9,246 ms |
| Status | 200 |

---

## Pre-Sprint 4 — `/discoveries`

| Metric | Value |
| --- | --- |
| UserConnection.findMany | 3+ (network, trust recs, trust profiles) |
| SharedIntroducerRelationship.findMany | 1 (trust profiles bulk) |
| DiscoveriesPost.findMany | 1 |

---

## Post-Sprint 4 — static estimate `/home`

| Metric | Before | After | Removed |
| --- | --- | --- | --- |
| StoryTag.findMany | 2 | 2 | 0 |
| Story.findMany | 5 | **4** | **1** |
| UserConnection.findMany | 2 | **1** | **1** |
| Total Prisma | 17 | **~15** | **~2** |

---

## Runtime capture (this session)

HTTP capture **blocked** — dev server not running (`fetch failed`).  
Unit tests: **6/6 PASS** (`npm run sprint:4-validation`).

---

## Commands

```powershell
npm run sprint:4-validation
npm run profile:http-capture -- --base=http://localhost:3000
npm run profile:database -- --skip-server --base=http://localhost:3000
```
