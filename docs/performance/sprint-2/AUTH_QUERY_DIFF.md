# Auth Query Diff (Before → After)

**Generated:** 2026-07-26T15:46:50.801Z

---

## Per-Request Auth Query Targets

| Symbol | Before | After | Δ |
| --- | --- | --- | --- |
| User.findUnique | 1 | 1 | 0 |
| AdminSettings.findUnique | 1 | 1 | 0 |
| NotificationPreferences.findUnique | 0–2 | 1 | −0–1 |
| getLayoutBadges invocations | 1–2 | 1 | −0–1 |
| Route getAuthUser (Supabase) | 0–1 extra | 0 | −0–1 |

---

## Page Query Count Estimates

| Page | Before | After (est.) | Δ |
| --- | --- | --- | --- |
| /home | 18 | 16 | −1–2 |
| /discoveries | 12 | 12 | 0 |
| /profile | 10 | 9 | −1 |
| /messages | 9 | 9 | 0 |
| /introductions | 8 | 7 | −0–1 |
| /profile (as settings) | 10 | 9 | −1 |

---

## HTTP TTFB Diff (when captured)

| Page | TTFB before | TTFB after | Δ |
| --- | --- | --- | --- |
| / | — | 7784 | — |
| /home | 29890 | 6103 | -23787ms |
| /discoveries | 16637 | 10002 | -6635ms |
| /profile | 16017 | 8781 | -7236ms |
| /messages | 5664 | 3772 | -1892ms |
| /introductions | 12381 | 3847 | -8534ms |
| /notifications | — | 3163 | — |

*Note: Dev-server TTFB includes compilation; compare trends, not absolute values.*
