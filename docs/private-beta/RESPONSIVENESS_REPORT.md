# Private Beta — Responsiveness Report

**Date:** 2026-08-02

## Principle

Under ~300 ms–3 s DB RTT (see db-forensics), the UI must **acknowledge immediately**. Skeleton + optimistic updates beat waiting for JSON.

## Interaction latency (UX)

| Interaction | Server wait | UI acknowledgement |
|-------------|-------------|--------------------|
| Nav to Messages | API ~3 s cold | Instant route skeleton |
| Like discovery | API ~RTT | Instant heart/count flip |
| Bookmark | API ~RTT | Instant toggle |
| Send message | API ~RTT | Input clears; bubble appears; spinner on send |
| Load intros | API | Tabs/search stay; list skeletons |
| Upload media | Transfer | Progress % + Cancel |

## Skeleton inventory

| Component / route | Skeleton |
|-------------------|----------|
| `home/loading.tsx` | HomeFeed + HomeStats |
| `discoveries/loading.tsx` | Title + feed cards |
| `messages/loading.tsx` | Conversation rows |
| `introductions/loading.tsx` | List cards |
| `profile/loading.tsx` | Avatar header |
| `ListLoading` variants | Reusable |

## Empty states

| Surface | CTA |
|---------|-----|
| Discoveries | Existing `DiscoveriesEmptyState` |
| Messages inbox | → `/create-story` |
| Introductions | → `/create-story` |

## Risks

| Risk | Mitigation |
|------|------------|
| Optimistic like race | Rollback + server reconcile |
| Optimistic message vs realtime | `replacesId` swap; failed removes temp |
| Skeleton mismatch | Variants per list type |

## Verdict

**Pass for private beta perceived performance** — first-time users see motion and feedback within a frame, not a multi-second blank page.
