# BUG_LIST — RC-1 Validation

**Date:** 2026-07-31

| ID | Severity | Area | Summary | Status |
| --- | --- | --- | --- | --- |
| RC3-002 | **Critical** | Reliability | Authenticated layout crashed with Application error when Prisma/pooler unavailable | **FIXED** |
| RC3-INFRA-001 | **Critical** | Infra | Supabase pooler unreachable / 1–6s+ latency (`P1001`, health `database: degraded`) | **OPEN (infra)** |
| RC3-001 | **High** | Security/CSRF | Production CSRF blocked `127.0.0.1` ↔ `localhost` same-port posts | **FIXED** |
| RC3-004 | **High** | API | Mutating APIs return empty HTTP 500 on DB outage instead of structured 503 | **OPEN** |
| RC3-003 | Medium | UX | Discovery CSRF failure message opaque | **FIXED** |
| RC3-005 | Medium | Infra | Redis `degraded` in lite health | **OPEN** |
| RC3-007 | Low | Auth UX | Invalid login toast easy to miss / no inline field error | **OPEN** |
| RC3-006 | Low | Ops | Version endpoint metadata stale vs current build | **OPEN** |
| RC3-008 | Low | UX | Discoveries file picker uses native unstyled “Choose File” | **OPEN** |
| QA-012 | Info | Product | Discovery delete/edit not implemented | **DOCUMENTED** |
| RC2-OBS-001 | Info | Product | Typing indicators not implemented | **DOCUMENTED** |

## Severity rubric

- **Critical:** Data loss, hard crash, auth break, or cannot complete core journey for real users  
- **High:** Core journey blocked under common conditions  
- **Medium:** Degraded UX / ops visibility  
- **Low / Info:** Polish or known product gaps  
