# Page-by-Page Query Breakdown

**Generated:** 2026-07-26T06:37:26.870Z

---

## Summary Table

| Page | Median total (ms) | Est. SQL time (ms) | Est. queries | Slowest contributor |
| --- | --- | --- | --- | --- |
| /home | 3684 | 8190 | 18 | StoryTag.findMany |
| /discoveries | 1978 | 5460 | 12 | DiscoveriesPost.findMany |
| /messages | 1713 | 3640 | 8 | Message.findMany |
| /introductions | 14397 | 3640 | 8 | Story.findMany |
| /profile | 5431 | 4550 | 10 | AnalyticsEvent aggregations |
| /create-story | 24727 | 1820 | 4 | AdminSettings.findUnique |
| /maindash | 15890 | 2730 | 6 | AdminSettings.findUnique |

---

## Per-Page Detail

### /home
- **Requests:** 1 document + layout streaming (3 Suspense boundaries)
- **Est. Prisma queries:** 14–18
- **Duplicates:** 4× StoryTag.findMany variants; getLayoutBadges deduped
- **Slowest:** StoryTag.findMany (pooler × 4)

### /discoveries
- **Est. queries:** 10–14
- **Pipeline:** network IDs → viewer → posts → category filter → trust bulk
- **Slowest:** DiscoveriesPost.findMany + SharedIntroducerRelationship.findMany

### /messages
- **Client-rendered inbox** → `GET /api/messages`
- **Slowest:** Message.findMany (unbounded)

### /profile (includes settings panels)
- **Parallel:** trust network, recommendations, analytics insights, notification prefs
- **Slowest:** Analytics aggregations

---

## HTTP Wall-Clock Capture

| Page | Status | TTFB (ms) | Total (ms) | Auth (ms) | Request ID |
| --- | --- | --- | --- | --- | --- |
| /home | 500 | 3417 | 3684 | 1319 | 54ec2997 |
| /discoveries | 500 | 1798 | 1978 | 389 | dd16f8ab |
| /messages | 500 | 1693 | 1713 | 382 | 87371c94 |
| /introductions | 500 | 14369 | 14397 | 364 | 0e91f982 |
| /profile | 500 | 5376 | 5431 | 522 | 88cedc08 |
| /create-story | 500 | 24694 | 24727 | 386 | 861c1b1c |
| /maindash | 500 | 15857 | 15890 | 605 | ced1b64d |

**Note:** First dev compile inflates TTFB. `prismaMs` headers require production build + `PROFILE_PRODUCTION=1`. Auth segment captured via `x-auth-profile-*` on dev.

## HTTP Capture Status

```json
{
  "base": "http://127.0.0.1:3012",
  "capturedAt": "2026-07-31T08:16:38.145Z"
}
```

Re-run: `PROFILE_PRODUCTION=1 npm run dev` then `npx tsx scripts/capture-http-profile.ts`
