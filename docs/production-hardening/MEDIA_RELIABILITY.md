# MEDIA_RELIABILITY

## Verified this session (:3070)

| Flow | Result |
| --- | --- |
| Image upload (1×1 PNG via API) | **200** — path under `/uploads/images/…`, ~3.4 s |
| Discovery text post (no media) | **201** |
| Loopback Origin alias post | **201** (CSRF fix holds) |

## Hardening

- Upload route: Prisma connectivity → **503** with structured reject (not empty 500)
- `useUpload`: maps **503** to retry-friendly message
- Existing progress / abort / size limits preserved (no behaviour change)

## Not re-automated here

Large video, cancel mid-flight, refresh-during-upload — prior RC coverage; no regressions introduced. Recommend one manual pass on VPS with a real phone photo/video before inviting users.

## Orphans / dedupe

Local provider + media object tracking unchanged; no new orphan paths introduced.
