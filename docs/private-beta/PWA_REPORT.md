# Private Beta — PWA Report

**Team:** Prompt 5  
**Date:** 2026-08-02

## Status: Installable & offline shell ready

| Item | Status |
|------|--------|
| Manifest | OK — standalone, icons, shortcuts, share_target |
| Icons / maskable | OK — `public/icons` |
| InstallPrompt | OK — Chromium BIP + iOS hint (auth shell) |
| Service worker | OK — Workbox; built via `build:sw` |
| Offline shell | OK — `offline.html` + OfflineDetector |
| Update banner | OK — UpdateManager |
| SW cache headers | OK — no-cache on `/sw.js` |

## Device checklist (ops)

- [ ] HTTPS install on phone  
- [ ] Standalone open  
- [ ] Airplane mode → offline shell  
- [ ] SW update prompt after deploy  

## Residual

| Item | Severity |
|------|----------|
| `pushsubscriptionchange` not in SW | High (push reliability) |
| Closed-app badge count from push | Medium |
| Non-en locale in SW openWindow | Low |

## Sign-off

**PWA install/offline: READY** for private beta on HTTPS.
