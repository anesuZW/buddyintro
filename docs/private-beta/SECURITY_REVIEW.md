# Private Beta — Security & Trust Review

**Team:** Prompt 6  
**Date:** 2026-08-02

## Attack attempts → handling

| Attempt | Result |
|---------|--------|
| Invalid body UUID (messages) | **422** structured |
| Missing permission (discovery like/share) | **403** |
| Discovery comment Forbidden | **403** (fixed this pass) |
| Expired session (nav) | Redirect login |
| Expired session (API) | **401** structured |
| CSRF evil Origin | **403** `csrf_rejected` |
| Oversized upload | **413** / client reject |
| Invalid MIME vs kind | **400** `invalid_mime` |
| Storage failure | Generic `storage_error` — no internals |
| Suspended account | **403** |
| Deleted/invisible story | Soft 404 |
| Path traversal media | **400** |

## Remaining High

| ID | Issue | Mitigation planned |
|----|-------|--------------------|
| SEC-01 | Invalid UUID path params → generic 500/error UI not 404 | Add Zod UUID on path params |
| SEC-02 | Some user APIs still unwrapped (trust/[userId], profile/[id], media GET, …) | `withApiHandler` |
| SEC-03 | MIME-only upload (no magic bytes) | Content sniff later |
| SEC-04 | `/api/metrics` open | Protect at nginx |

## Leakage

No stack traces or Prisma internals to clients on hardened paths (Prompt 1).

## Sign-off

**Trust posture acceptable for private beta** with ops note on metrics + nginx body size.
