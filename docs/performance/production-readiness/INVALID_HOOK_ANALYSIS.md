# INVALID_HOOK_ANALYSIS

**Phase:** Production Readiness — Phase 4  
**Generated:** 2026-07-31  
**Mode:** READ-ONLY

---

## Symptom

Runtime / overlay errors of the form:

- `Invalid hook call`
- `Cannot read properties of null (reading 'useContext')`

Often stacked through `IntlProvider` / `use-intl`, Next `ErrorBoundary`, or `usePathname`.

---

## Root cause (determined)

**Primary root cause:** Dev-time **Fast Refresh / SSR failure cascade**.

When a Server Component tree throws or stalls (today: Prisma **P2022** on `preferred_language`; historically: pooler timeouts), Next.js HMR / error recovery tears down the React dispatcher. Client components still attempting hooks then fail with “Invalid hook call” / null `useContext`.

This is a **secondary effect**, not incorrect hook placement in application source.

| Claim | Label |
| --- | --- |
| Hook errors follow SSR/DB failures | Prior Runtime docs (`docs/PERFORMANCE_FIX_REPORT.md`, QA-011) + current 500s |
| No missing `"use client"` on hook-using modules | **Static Analysis** (repo scan) |
| Single app React version `18.3.1` deduped | **Static Analysis** (`npm ls`) |
| `next/dist/compiled/react` coexistence | **Static Analysis** — expected for Next 14, not a duplicate install bug |
| `error.tsx` documents cascade / retry | **Static Analysis** |

---

## Investigations performed

### Duplicate React installations

| Check | Result |
| --- | --- |
| `npm ls react` | Single `react@18.3.1` (deduped) |
| `react-dom` | `18.3.1` |
| Extra `node_modules/**/react` package roots | Only top-level + Next compiled builtin |

**Verdict:** Not caused by multiple React copies. **Static Analysis.**

### Multiple React versions

App: 18.3.1. Next compiled: react-builtin ~18.3.0-canary. Normal for Next 14. **Not** the smoking gun.

### Client imported by Server / Server into Client

- Layout correctly wraps client providers (`NextIntlClientProvider`, `LanguageProvider`, …).
- Hook-using files under `app/`, `components/`, `hooks/` start with `"use client"` where hooks are used.
- No systematic server-only import into client modules found in scan.

**Verdict:** No structural misuse identified. **Static Analysis.**

### next-intl boundaries

`NextIntlClientProvider` in `app/[locale]/layout.tsx` is correct. Failure stacks mentioning `IntlProvider` indicate **dispatcher already null**, not wrong provider placement.

### Invalid hook usage

No hooks found in Server Components, loops, or conditional top-level calls in the audited tree. **Static Analysis.**

---

## Current trigger (2026-07-31)

Authenticated navigations throw in `MainLayout` → `requireUser` → `getCurrentUser` → `User.findUnique` (**missing column**). That produces HTTP 500 and is a high-probability cascade trigger for hook overlay noise in `next dev`.

**Runtime Evidence:** server log `df7f19d1` / P2022 on `/home`.

---

## What was NOT done

- Did **not** suppress the warning.
- Did **not** change React / next-intl / error boundaries.

---

## Fix direction (for later phases — not executed)

1. Resolve schema drift so SSR stops throwing.  
2. Keep treating residual Invalid hook noise in `next dev` as HMR artifact unless it reproduces on **production** `next start` with healthy DB.

**Production reproduction of Invalid hook:** **Unverified** this session (pages 500 before UI; no prod build CWV run).
