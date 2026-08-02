# PWA_HARDENING

## Verified

| Asset | Status | Notes |
| --- | --- | --- |
| `/manifest.webmanifest` | 200 | name, icons, standalone, shortcuts, share_target |
| `/sw.js` | 200 | `Cache-Control: no-cache, no-store, must-revalidate` |
| Icons 192–512 + maskable | Present | |
| Install prompt | Lazy-loaded | Phase 3; behaviour unchanged |

## Production checklist (manual on HTTPS origin)

1. Install to home screen  
2. Launch standalone  
3. Kill network → offline shell / retry  
4. Deploy new build → SW update prompt  

## Gaps (external / environment)

- Install criteria require HTTPS + engagement on real devices  
- Authenticated RSC pages are not fully offline-capable by design  
