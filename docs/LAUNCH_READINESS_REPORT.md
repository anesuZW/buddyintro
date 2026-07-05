# Launch Readiness Report

Generated: 2026-06-23

**Launch today: CONDITIONAL PASS**

BuddyIntro is safe for a **controlled beta of ~100 real users** after the fixes in this audit, provided production email (Resend + verified domain) is configured and `/introductions` is smoke-tested on the deploy target.

---

## Audit deliverables

| # | Task | Report | Code fix |
| - | ---- | ------ | -------- |
| 1 | `userConnection.findMany` audit | [USER_CONNECTION_AUDIT.md](./USER_CONNECTION_AUDIT.md) | None (documented) |
| 2 | NotificationPreferences race | [NOTIFICATION_RACE_FIX.md](./NOTIFICATION_RACE_FIX.md) | **Yes** |
| 3 | Middleware exclusions | [MIDDLEWARE_EXCLUSION_AUDIT.md](./MIDDLEWARE_EXCLUSION_AUDIT.md) | **Yes** |
| 4 | Email / Resend | [EMAIL_DELIVERABILITY_REPORT.md](./EMAIL_DELIVERABILITY_REPORT.md) | None (ops) |

---

## Post-fix verification

| Check | Result |
| ----- | ------ |
| `npm run lint` | **PASS** (1 pre-existing hook warning in `NotificationBell.tsx`) |
| `npx tsc --noEmit` | **PASS** |
| `npm test` | **PASS** — 30/30 |
| Production benchmark (`profile-production`, port 3012, 1 warm run) | **WARNING** — `/introductions` returned **500** (other routes 200) |
| 100-user validation sample | **PASS** — 100/100 |

---

## Fixes shipped in this audit

1. **`middleware.ts`** — exclude `manifest.webmanifest`, `/offline`, `/icons/*`, `/api/health` from auth matcher.
2. **`notification-service.ts`** — read-first preferences; create with `P2002` retry; no upsert-on-GET.
3. **`app/api/auth/bootstrap/route.ts`** — tolerate concurrent user create (`P2002`).
4. **`lib/prisma-errors.ts`** — shared unique-violation helper.

---

## Issues that can impact the first 100 real users

### Blockers (must address before launch)

| Issue | Impact | Action |
| ----- | ------ | ------ |
| **Resend not configured / unverified domain** | Invite & notification emails silently fail | Set `RESEND_API_KEY` + verify sending domain in Resend |
| **`/introductions` HTTP 500** (observed in benchmark) | Core nav tab broken | Reproduce on staging; check server logs for `listIntroductionCategories` / SSR error |

### High (degraded experience, not data loss)

| Issue | Impact | Action |
| ----- | ------ | ------ |
| **Auth middleware ~270–350ms per request** | Slow TTFB on every page | Known; colocate with Supabase eu-west-1; JWT cache (roadmap P0) |
| **Safe concurrency ~25 users** | Errors/timeouts above 25 simultaneous | Cap beta invites; single VPS OK for 100 registered users if not all online |
| **Gmail in `EMAIL_FROM` env** (if set locally) | Resend rejects mail | Use `invites@yourdomain.com` on verified domain |

### Low at 100 users (monitor, not launch blockers)

| Issue | Impact |
| ----- | ------ |
| Unbounded `getNetworkUserIdsFromConnections` | Discoveries slower as networks grow; OK at 100 users |
| Full-table graph refresh jobs | Background only |
| `NotificationBell` exhaustive-deps lint warning | No functional impact observed |

---

## Capacity snapshot (from load investigation)

| Metric | Value |
| ------ | ----- |
| Safe concurrent users | **≤25** |
| Breaking point | **~100 VUs** (Node access violation on Windows dev; journey errors @ 50+) |
| Memory @ 25 VU × 30 min | **Stable** (post-warmup) |
| Primary bottleneck | Supabase Auth RTT + single Node process |

See [BUDDYINTRO_SCALE_ASSESSMENT.md](./BUDDYINTRO_SCALE_ASSESSMENT.md).

---

## Launch checklist (ops)

- [ ] Verify domain in Resend; set `EMAIL_FROM` to verified address
- [ ] Confirm `RESEND_API_KEY` in production secrets
- [ ] Smoke test: signup → bootstrap → home → discoveries → **introductions** → messages
- [ ] Confirm `/api/health` returns 200 without auth headers
- [ ] Confirm PWA manifest + offline page load without login redirect
- [ ] Region: deploy app in **eu-west-1** (same as Supabase)

---

## Verdict

| Question | Answer |
| -------- | ------ |
| **Launch today?** | **CONDITIONAL PASS** — code fixes merged; ops + `/introductions` smoke test required |
| **First 100 real users (registered, not concurrent)?** | **YES** if email configured and introductions page verified |
| **First 100 simultaneous?** | **NO** — stay under ~25 concurrent |

*Supporting audits: USER_CONNECTION_AUDIT, NOTIFICATION_RACE_FIX, MIDDLEWARE_EXCLUSION_AUDIT, EMAIL_DELIVERABILITY_REPORT*
