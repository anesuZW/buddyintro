# UX_REPORT — RC-1 Validation

**Date:** 2026-07-31  
**Method:** Real browser session (landing → login → home → discoveries) + smoke

---

## First 30 seconds

| Question | Answer |
| --- | --- |
| Would an average user continue? | **Yes**, when the app loads — landing is clear, branded, professional dark UI, obvious CTA |
| Friction | Cookie banner covers lower content until accepted; acceptable for compliance |

## Journey notes

| Area | Observation | Churn risk |
| --- | --- | --- |
| Landing | Strong brand + value prop; CTAs clear | Low |
| Login | Clean form; invalid credentials rely on toast (easy to miss) | Medium |
| Home empty state | Helpful welcome copy; stats at 0 feel honest for new users | Low |
| Discoveries empty | Excellent explanatory empty state | Low |
| DB outage (before fix) | Hard **Application error** — users leave | **Critical** |
| DB outage (after fix) | Calm “temporarily unavailable” + retry | Acceptable |
| Nav | Bottom nav clear; + create affordance obvious | Low |
| Theme toggle | Present | Low |

## Would I recommend this app?

**Yes for beta**, if production DB latency is healthy and the RC3 shell/CSRF fixes are deployed.  
**No for broad launch** until pooler reliability is proven in the target region and upload + push are re-certified on the VPS.

## Friction that still causes churn risk

1. Multi-second page waits (infra)  
2. Mutations failing without friendly API errors during outages  
3. Toast-only auth errors  
