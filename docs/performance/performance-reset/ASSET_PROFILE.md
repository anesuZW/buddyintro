# Asset Profile

**Sprint:** Performance Reset (READ-ONLY)  
**Generated:** 2026-07-31

---

## Production First Load JS (documented)

Source: `docs/PERFORMANCE_AUDIT.md` / `docs/deployment/PERFORMANCE.md`

| Route | First Load JS |
| --- | --- |
| `/home` | ~110–120 KB |
| `/discoveries` | ~221 KB |
| `/create-story` | ~215 KB |
| `/introductions` | ~113 KB |

Heavy libraries called out historically: `framer-motion`, `@supabase/*`, StoryUploader.

**No `@next/bundle-analyzer` wired** in `next.config.js`. No `compress` flag set (Next defaults still gzip in many hosts).

---

## Dev build on-disk chunks (live `.next/static`)

| File | Size |
| --- | --- |
| `chunks/main-app.js` | **5.88 MB** |
| `_app-pages-browser_…StoryUploader_tsx.js` | **2.16 MB** |
| `app-pages-internals.js` | 130 KB |
| `polyfills.js` | 110 KB |
| `webpack.js` | 55 KB |
| `layout.css` (app) | 48 KB |
| Inter woff2 files | 10–83 KB each |

### Browser transfer (landing, gzip-ish encoded)

| Resource | Transfer | Decoded |
| --- | --- | --- |
| main-app.js | 1.31 MB | 5.88 MB |
| locale layout.js | 352 KB | 1.47 MB |
| page.js | 43 KB | 206 KB |
| layout.css | 9 KB | 48 KB |

**Do not treat dev decoded sizes as production budgets.** They explain why local `next dev` feels heavier than a standalone production build.

---

## Fonts

- `lib/fonts.ts` — Google **Inter** via `next/font` (`display: swap`)
- Self-hosted under `.next/static/media/*.woff2`
- Largest observed Inter file ~83 KB

---

## Images / public

| Asset | Size |
| --- | --- |
| `public/qa/test-video.webm` | 114 KB |
| `public/qa/test-voice.webm` | 114 KB |
| Workbox dev scripts | 32–51 KB each |
| `public/icons/icon-512.png` | 17 KB |

No multi-megabyte public marketing images. Runtime story/media bytes come from storage via `/api/media` (not inventoried this session).

---

## Compression

| Layer | Status |
| --- | --- |
| Browser resource timing | Encoded &lt; decoded for JS (compression active on responses) |
| `next.config.js` compress | Not explicitly set |
| CDN | Not measured (local) |

---

## Asset contribution to “feels slow”

| Environment | Assets vs TTFB |
| --- | --- |
| Local `next dev` landing | After 2.57 s TTFB, assets add ~0.2–0.3 s to load |
| Local authenticated (when healthy) | TTFB 2–9 s dwarfs asset time |
| Production (est.) | FLJS 110–221 KB secondary to DB RTT unless TTFB fixed |

**Rank:** Assets are a **third-tier** concern after pooler RTT and auth RTT, except StoryUploader / discoveries client bundles on specific routes.
