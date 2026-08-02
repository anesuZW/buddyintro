# USER_JOURNEYS

## Executed this hardening pass

| Journey | Result |
| --- | --- |
| Login (API session) | Pass |
| Home authenticated | **200** |
| Discoveries list | **200** empty/posts |
| Create discovery (text) | **201** |
| Create discovery (127↔localhost Origin) | **201** |
| Upload image | **200** |
| Messages list | **200** |
| Notifications list | **200** |
| Stories list | **200** |
| Push config probe | **200** configured |
| Unauth API | **401** |
| Cross-origin mutate | **403** |
| Invalid message body | **422** |
| PWA manifest + SW | **200** |

## Not fully re-run (rely on prior RC + no code path change)

Signup invite token, dual-user messaging realtime, story video playback, device push tap, OS install prompt.

## Blockers found & fixed

Empty 500 / crash on dependency failure → structured **503** + Service Unavailable (prior + this pass).
