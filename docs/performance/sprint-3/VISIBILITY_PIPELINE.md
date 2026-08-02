# Visibility Pipeline Audit

**Generated:** 2026-07-26T16:19:37.723Z

---

## filterStoriesByVisibilityGate

**Before:** 2× `StoryTag.findMany` scoped to `otherAuthorIds` from loaded stories.

**After:** Accepts optional `HomeVisibilityPrefetch`:

- `coTagAuthorIds` — all authors who tagged the viewer (from consolidated scan)
- `everIntroducedAuthorIds` — authors with published **or expired** intro stories tagging viewer

**Rules unchanged:** SPECIFIC_PEOPLE_ONLY, EVERYONE_I_HAVE_INTRODUCED, MUTUAL_INTRODUCTION_NETWORK switch logic identical.

**Home path:** `getStoryBarForViewer` passes `ctx.visibility` from `getHomeStoryContext`.

**Non-home paths:** No prefetch → original 2-query path preserved.
