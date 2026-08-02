# NOTIFICATION_HARDENING

## In-app

| Check | Result |
| --- | --- |
| `GET /api/notifications` | **200** structured list |
| PATCH validation | **422** on bad body (hardened) |
| Badge resilience | Zeros on DB blip (layout-badges) |

## Push

| Check | Result |
| --- | --- |
| VAPID public key exposed | Yes (`configured: true` in this env) |
| Subscribe without keys | Would return **503** `push_not_configured` |
| Delivery / click / badge on device | **Manual on HTTPS** — not automatable here |

## Graceful failure

Push send path already no-ops when VAPID unset (`deliverPushToUserDirect`). Subscribe POST now fails closed with **503** instead of opaque 500.
