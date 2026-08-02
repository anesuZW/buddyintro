# BUG_FIX_LOG

## PH-001 / PH-002 — Empty HTTP 500 on DB outage

| | |
| --- | --- |
| **Reproduce** | Stop/unreachable pooler → `POST /api/discoveries` or any authed API |
| **Before** | Empty body `500` / Application error digests |
| **Root cause** | Prisma `P1001` thrown through `getCurrentUser` / handlers uncaught |
| **Fix** | Connectivity detection + `serviceUnavailableResponse()` + `withApiHandler` + auth API catch |
| **Verify** | When DB up: discoveries **201**, upload **200**. CSRF still **403**. Invalid UUID message **422**. |

## PH-003 — Core API consistency

Wrapped high-traffic routes so uncaught errors cannot leak blank 500s.

## PH-005 — Push without confusing failures

`GET /api/push/subscribe` returns `{ configured: true/false }`. `POST` returns **503** `push_not_configured` if keys missing (keys present in this env → configured true).

## Carry-forward from RC-1

| ID | Status |
| --- | --- |
| RC3-001 CSRF loopback | Fixed (re-verified: alias origin POST **201**) |
| RC3-002 Service Unavailable shell | Fixed (prior) |
| RC3-INFRA-001 Pooler latency | **External** — health still `database: degraded` (~3 s) from this host |
