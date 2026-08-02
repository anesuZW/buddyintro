# NETWORK_RESILIENCE

## Simulated / observed

| Condition | App behaviour |
| --- | --- |
| High DB latency (~3 s) | Pages load slowly; health `degraded`; no crash |
| Pooler unreachable (prior RC) | Service Unavailable shell; APIs **503** JSON after PH fixes |
| CSRF / wrong origin | **403** structured |
| Client mutation during 503 | Toast: retry shortly |

## User-facing principles

1. Never blank Application error for dependency flaps  
2. Always JSON on API failures  
3. Prefer retry language over stack traces  

## Infra note

Sustained multi-second pooler RTT from distant clients remains the dominant UX risk — ops concern, not app logic.
