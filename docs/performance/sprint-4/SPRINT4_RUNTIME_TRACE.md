# Sprint 4 Runtime Trace

**Generated:** 2026-07-27  
**Status:** **BLOCKED** — dev server not running during validation

---

## Expected `/home` query order (static)

| # | Model.Operation | Caller |
| --- | --- | --- |
| 1–2 | User.findUnique | Auth |
| 3 | AdminSettings.findUnique | Admin settings |
| 4–5 | StoryTag.findMany | `getHomeStoryContext` |
| 6–8 | Message/Notification/Story.count | Layout badges |
| 9 | UserConnection.findMany | `getHomeUserConnections` |
| 10 | Story.findMany | `getHomeVisibleStoryRows` |
| 11–12 | Story.findMany | Trust recent sent/received |
| 13 | SharedIntroducerRelationship.groupBy | Introduction suggestions |
| 14 | Story.findMany | Mutual author distinct |
| 15 | Post.findMany | Feed posts |
| 16 | UserConnection.findFirst | Materialization (cached) |
| 17 | SharedIntroducerRelationship.findMany | Top pair recs (conditional) |

**Expected Story.findMany: 4** (down from 5)  
**Expected UserConnection.findMany: 1** (down from 2)

---

## Re-run when server available

```powershell
$env:PROFILE_PRODUCTION='1'; npm run dev -- -p 3000
npm run sprint:4-validation -- --base=http://localhost:3000
```

Compare server `[prisma:slow]` log against Sprint 3 verification `home-trace-capture.json`.
