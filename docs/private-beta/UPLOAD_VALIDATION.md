# Private Beta — Upload Validation

**Team:** Prompt 2 — Media Uploads  
**Date:** 2026-08-02

## Limits & contracts

| Rule | Value |
|------|-------|
| Max file size | **25 MB** (`MAX_UPLOAD_BYTES`) |
| Content-Length pre-check | 25 MB + **1 MB** multipart slack |
| Authoritative size | `file.size` after multipart parse |
| Kinds | `image` \| `video` \| `audio` |
| MIME | Must match kind when `Content-Type` is present |
| Auth | Required (`requireUserApi`) |
| CSRF | Origin allowlist (loopback aliases) |

## Expected outcomes

| Case | Expected HTTP / client |
|------|------------------------|
| Image / video / audio under limit | **200** `{ url, path, … }` |
| Near-limit file (~24–25 MB) | **200** (not false 413 from Content-Length) |
| File > 25 MB (client) | Thrown before XHR; no retries |
| File > 25 MB (server `file.size`) | **413** `app_body_limit` — **no retry** |
| Proxy truncated body | **413** `proxy_body_limit` — **no retry** |
| Unauthenticated | **401** structured |
| Bad Origin | **403** `csrf_rejected` — **no retry** |
| Wrong MIME for kind | **400** `invalid_mime` — **no retry** |
| Empty / missing file | **400** `missing_file` |
| DB down during register | **503** `service_unavailable` — client retries with backoff |
| Storage failure | **500** `storage_error` (generic reason) — client may retry |
| Cancel mid-upload | `AbortError`; toast “Upload cancelled”; no publish |
| Double-tap Publish | Single-flight / submit lock — one upload |
| Same bytes twice (local) | `deduplicated: true` when provider supports it |

## Client retry policy (`useUpload`)

| Status / error | Retries? |
|----------------|----------|
| Network / timeout / **5xx** / **503** | Yes (up to 2), exponential backoff 500→1000→2000 ms |
| **4xx** (413, 401, 403, 400) | **No** |
| Abort | No — surface as cancel |

XHR timeout: **120 s** (aligned with nginx proxy timeouts).

## UI coverage

| Surface | Progress | Cancel | Double-submit guard |
|---------|----------|--------|---------------------|
| StoryUploader | Yes (%) | Yes | `submitLockRef` |
| DiscoveriesComposer | Yes (%) | Yes | `submitLock` |
| ProfileEditor avatar | Yes (%) | Yes | `useUpload` in-flight |

## Manual VPS checklist (before inviting users)

- [ ] Phone photo < 25 MB → success  
- [ ] Phone video near limit → success or clear 413 (not hang)  
- [ ] Cancel mid-upload → no story/discovery created  
- [ ] Airplane mode mid-upload → friendly retry message  
- [ ] Confirm nginx `client_max_body_size ≥ 26m` and body timeouts ≥ 120s  
