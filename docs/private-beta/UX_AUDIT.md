# Private Beta — UX Audit

**Team:** Prompt 3 — User Experience & Responsiveness  
**Date:** 2026-08-02  
**Constraint:** No SQL optimization — perceived performance only.

## First-time user test

> “Would a first-time user think this is fast?”

| Screen | Before | After this pass |
|--------|--------|-----------------|
| Home | Good Suspense + skeletons | + route `loading.tsx` |
| Discoveries | Blank until SSR; slow likes | Route skeleton; optimistic like/bookmark; feed skeletons |
| Messages | Text “Loading…” | Conversation skeletons; empty CTA; optimistic send |
| Introductions | Full-page loading wipe | Chrome stays; list skeletons; empty CTA |
| Profile | Blank wait | Route skeleton |
| Create story | Upload progress existed | + Cancel (Prompt 2) |

## Changes shipped

1. Route `loading.tsx` for home, discoveries, messages, introductions, profile  
2. `ListLoading` shape-matching skeletons (`list` / `feed` / `conversations`)  
3. Optimistic discoveries like & bookmark (rollback on failure)  
4. Optimistic message send (temp bubble → reconcile / remove on fail)  
5. Messages & introductions empty states with **Create an introduction** CTA  
6. Introductions keep search/tabs visible while loading  

## Still nice-to-have (not blocking)

- Suspense-split Discoveries title vs feed (partially mitigated by `loading.tsx` + SoftLoadFailure)
- Comment optimistic append
- Shared `Button` `loading` prop

## Sign-off

Perceived speed is **materially better** for first-time navigation and interactions under slow DB. Proceed to Prompt 4.
