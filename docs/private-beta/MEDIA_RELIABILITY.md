# Private Beta — Media Reliability

**Team:** Prompt 2 — Media Uploads  
**Date:** 2026-08-02  
**Related:** `UPLOAD_VALIDATION.md`, `docs/production-hardening/MEDIA_RELIABILITY.md`

## Mission status

| Stop condition | Status |
|----------------|--------|
| Uploads consistently succeed (happy path) | **Met** for images/small video when infra limits allow |
| Failures recover gracefully | **Met** — structured rejects, 5xx retry + backoff, cancel |
| Users always understand what's happening | **Met** — progress %, Cancel, friendly toasts |

## Architecture (unchanged product behaviour)

```
UI (Story / Discoveries / Profile)
  → useUpload (XHR + progress + abort + retry)
  → POST /api/media/upload
  → storage provider (local / configured)
  → media_objects registry (+ optional worker processing)
  → attach URL on story / discovery / profile save
```

## Fixes this pass

| Issue | Fix |
|-------|-----|
| 4xx retried 3× | Retry only network / ≥500 |
| Near-limit false 413 | Content-Length slack +1 MB |
| No MIME check | `invalid_mime` when type≠kind |
| Cancel unused | Wired in Story, Discoveries, Profile |
| No progress on Discoveries/Profile | Progress % + Cancel |
| Double upload | In-flight guard + submit locks |
| Slow hang | XHR 120s timeout + backoff |
| Orphans never cleaned | Cleanup no longer treats all `media_objects` as referenced; deletes orphan registry rows |
| Storage 500 leaked internals | Generic `storage_error` reason (Prompt 1) |

## Scenario matrix

| Scenario | Behaviour |
|----------|-----------|
| Large / slow upload | Progress updates; completes within 120s or clear timeout toast + retry |
| Cancel mid-flight | Abort XHR; “Upload cancelled”; no create call if cancel during upload |
| Refresh during upload | Request aborts with page unload; user retries; orphan cleaned after `maxAgeHours` |
| Upload OK, create POST fails | Friendly toast; media may orphan until nightly cleanup (grace = maxAgeHours, default 24h) |
| Avatar pick then leave without Save | Orphan until cleanup age; documented — Save still required to attach |
| Processing worker down | Original URL still served; processing status may stay pending/failed without breaking feed |
| Nightly cleanup | Deletes unreferenced files older than maxAgeHours; removes matching `media_objects` |
| Dedup (local) | Same SHA may return `deduplicated: true` |

## Ops requirements

1. Nginx: `client_max_body_size 26m` (see `deployment/templates/nginx-buddyintro.conf`)
2. Proxy timeouts ≥ 120s for upload location
3. Media worker process running (PM2) for variants
4. Schedule `media:cleanup` (or admin job) with sensible `maxAgeHours`

## Residual risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| MU-01 | Avatar/story upload before attach → temporary orphan | Low | Cleanup after grace period |
| MU-02 | Create fails after upload — no immediate release API | Medium | Cleanup job; optional future release-on-fail |
| MU-03 | Live VPS nginx not matching template | High | Ops verify before beta |

## Sign-off (Prompt 2)

Upload path is **rock-solid enough for private beta** pending one manual VPS photo/video pass.  
Proceed to Prompt 3 (UX & Responsiveness).
