# UPLOAD_REPORT — RC-1 Validation

**Date:** 2026-07-31

---

## Exercises

| Test | Result | Notes |
| --- | --- | --- |
| Discovery text post (browser) | **Blocked then infra** | First: **403 csrf_rejected** on `127.0.0.1` (RC3-001). After fix + rebuild: POST hits auth/DB; under outage → **500** |
| `POST /api/media/upload` 1×1 PNG (script) | **500** during pooler outage | ~5 s; empty body (RC3-004) |
| Prior RC1/RC2 image upload | **PASS** historically when pooler healthy (~3.3 s) | Reuse evidence |
| Large / video / cancel / retry | **Not completed** this run | Blocked by pooler + time |

## CSRF interaction

Uploads go through middleware origin check. Loopback alias fix (RC3-001) is required for local production testing and any Host/Origin mismatch on loopback.

## UX notes

- Discoveries composer uses native file input (“Choose File”) — functional but unpolished (RC3-008)  
- `useUpload` already maps CSRF to a readable string; discoveries composer now does too  

## Verdict

**Upload pipeline code path exists and was proven in prior RCs.**  
**This session cannot certify uploads** while pooler returns `P1001`. Re-run mutate smoke on VPS after deploy:

```bash
node docs/release-candidate/artifacts/rc-mutate-smoke.mjs --base=https://YOUR_ORIGIN
```
