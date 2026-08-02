# Sprint 5A Baseline Verification

**Generated:** 2026-07-27  
**Git commit:** `87edda0` (+ Sprint 4 uncommitted working tree)  
**Checkpoint:** `checkpoint/sprint-5a-start`  
**Evidence:** Sprint 4 static estimates, Sprint 3 runtime trace, validation run

---

## Sprint 4 end state — `/home` (static)

| Metric | Value | Source |
| --- | --- | --- |
| StoryTag.findMany | 2 | Sprint 3/4 verified |
| Story.findMany | **4** | Sprint 4 consolidation |
| Story.count | 1 | Layout badges |
| UserConnection.findMany | 1 | `getHomeUserConnections` |
| UserConnection.findFirst | 1 | Materialization probe (cached) |
| SharedIntroducerRelationship.groupBy | 1 | Introduction suggestions |
| Post.findMany | 1 | Mutual feed |
| **Total Prisma (est.)** | **~15** | Sprint 4 `baseline-after.json` |

---

## Sprint 3 runtime reference (request `2afc354d`)

| Story.findMany | Duration (slow log) | Purpose |
| --- | --- | --- |
| #1 | 682 ms | Trust recent sent |
| #2 | 687 ms | Trust recent received |
| #3 | 624 ms | Visible pool (pre-S4 separate bar query) |
| #4 | 1,310 ms | Feed co-tag (pre-S4) |
| #5 | 4,898 ms | Mutual author distinct |

Sprint 4 eliminated query #4 (feed co-tag) via projection from visible pool.

---

## Live capture (this session)

| Command | Result |
| --- | --- |
| `npm run sprint:4-validation` | Unit tests **6/6 PASS** |
| HTTP `/home` | **BLOCKED** — dev server not running |
| `profile:database` | Not run (no server) |
| `profile:http-capture` | Not run (no server) |

---

## Pooler context (established Sprint 1)

| Metric | Value |
| --- | --- |
| SELECT 1 avg | ~587 ms |
| SELECT 1 p95 | ~3,109 ms |
| Dominant cost | Round trips, not SQL execution |

---

## Reproduction

```powershell
$env:PROFILE_PRODUCTION='1'; npm run dev -- -p 3000
npm run profile:http-capture -- --base=http://localhost:3000
npm run sprint:4-validation -- --base=http://localhost:3000
```
