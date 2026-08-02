# Private Beta — Notifications Report

**Team:** Prompt 5  
**Date:** 2026-08-02

## In-app notifications

| Item | Status |
|------|--------|
| Notifications page + mark read | OK |
| Bell + layout badges | OK (degrade to 0 on DB blip) |
| Preferences UI | OK |

## Web push

| Item | Status |
|------|--------|
| Subscribe API | OK — 503 if VAPID missing |
| Enable button | OK — now syncs `enablePushNotifications: true` on success |
| Delivery | Requires VAPID + worker if Redis |
| Deep links | OK when client open; SW uses bare paths |
| Device E2E | **Not completed this pass** |

## Ops Critical before claiming push

1. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`  
2. If `REDIS_URL` set → run `buddyintro-push-worker`  
3. One real-device: enable → test → tap notification  

## Sign-off

**In-app: READY.**  
**Web push: READY WITH OPS DEPENDENCIES** — do not market push until device E2E.
