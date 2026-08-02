# SECURITY_REVIEW

## Checks

| Attack / case | Result |
| --- | --- |
| Unauthenticated feed/discoveries/messages | **401** |
| Mutate with `Origin: https://evil.example` | **403** `csrf_rejected` |
| Invalid UUID in message POST | **422** (no server throw) |
| Suspended/banned | Existing **403** path preserved |
| Loopback Host alias CSRF | Allowed only for loopback↔loopback same port (intentional) |

## Not weakened

- CSRF still required for mutating methods with Origin/Referer  
- Auth still via Supabase session + DB user  
- No permission or visibility rule changes  

## Ops

Ensure production `NEXT_PUBLIC_APP_URL` / `ALLOWED_ORIGINS` match the public HTTPS origin exactly.
