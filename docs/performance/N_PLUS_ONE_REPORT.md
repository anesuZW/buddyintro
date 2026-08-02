# N+1 Query Report

**Generated:** 2026-07-26T06:37:26.870Z  
**Scope:** Static code analysis + Phase 2 heuristics (`detectPhase2Issues`)

---

## Summary

True loop-based N+1 (async map over Prisma) is **limited** in current codebase — most duplication is **architectural** (multiple services issuing similar `findMany` scans) or **unbounded single queries** (messages inbox).

Phase 2 auto-detection flags:
- `findMany` with `count >= 3`
- `User.findUnique` total count >= 3
- Repeated same `Model.operation` key

---

## Detected Patterns

| Page | Service | Loop / Pattern | Est. duplicates | Severity | File |
| --- | --- | --- | --- | --- | --- |
| /home | getIntroductionSuggestions | O(n²) pair scan over introducedByViewer tags | Up to 400 SharedIntroducerCount lookups without ctx batching | medium | `services/introduction-suggestions.ts` |
| /discoveries | filterByCategoryVisibility | Per-post category gate (partially batched) | 0–2 queries per post when cross-category disabled | medium | `lib/category-visibility.ts` |
| /discoveries | getTrustProfilesBulk | Bulk fetch but OR clause per author for SharedIntroducerRelationship | 1 bulk query (not N+1) — OR array scales with author count | low | `services/trust-profile.ts` |
| /messages | getConversationList | Loads all messages then dedupes in JS | 1 unbounded findMany — not N+1 but O(all messages) | high | `services/messages.ts` |
| /home | getHomeStoryContext | 4 parallel StoryTag.findMany — same tags scanned multiple ways | 4 queries/request (by design, not loop N+1) | medium | `services/home-dashboard.ts` |
| layout (all pages) | getLayoutBadges | Called from TopBar + BottomNav — React cache dedupes | 1× effective (2 call sites, 1 execution) | info | `components/layout/LayoutBadges.tsx` |
| all authenticated | getAdminSettings | Called from many services without always passing settingsOverride | 1× per request (React cache) but 3–8 call sites | info | `services/admin.ts` |
| /discoveries | getDiscoveriesFeed | getAdminSettings called in page AND inside feed if no override | 1× when settingsOverride passed (page does pass) | info | `app/[locale]/(main)/discoveries/page.tsx` |

---

## High-Priority Watch List

| Model | Risk | Primary path |
|-------|------|--------------|
| StoryTag.findMany | 4× on home via getHomeStoryContext | `/home` |
| Message.findMany | Unbounded inbox load | `/messages` API |
| SharedIntroducerRelationship.findMany | Bulk OR per author set | `/discoveries` trust enrichment |
| User.findUnique | Repeated if cache() bypassed | Auth + per-author lookups in trust-profile |
