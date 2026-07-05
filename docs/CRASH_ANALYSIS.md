# Crash Root Cause Analysis

Generated: 2026-06-23T07:18:42.260Z

---

## Summary

| Field | Value |
| ----- | ----- |
| Crash occurred | **Yes** |
| Classification | **access-violation** |
| Exit code | 3221226505 |
| Signal | — |

No crash observed during this investigation run. Prior concurrency run (100 VU journey) recorded 100% errors with ~6ms latency (connection refused) and server exit 3221226505 — consistent with access violation crash mid-test.

---

## Pre-crash process state

| Metric | Value |
| ------ | ----- |
| Heap before crash | 125.4 MB |
| RSS before crash | 299.1 MB |
| Event loop lag | 194.12 ms |

---

## Last stdout (tail)

```
loadSession=11ms
getUserNetwork=0ms
refreshNetwork=277ms
responseBuild=1ms
total=297ms
[AUTH-PROFILE][75dcf8bb] middleware segments path=/introductions
createClient=1ms
loadSession=4ms
getUserNetwork=0ms
refreshNetwork=253ms
responseBuild=0ms
total=258ms
[AUTH-PROFILE][e42c9be7] middleware segments path=/api/messages/63aec623-fce2-4daa-99ab-79d0a0099d4c/context
createClient=1ms
loadSession=4ms
getUserNetwork=0ms
refreshNetwork=329ms
responseBuild=1ms
total=336ms

```

---

## Last stderr (tail)

```
}
 [AuthApiError: Request rate limit reached] {
  __isAuthError: true,
  name: 'AuthApiError',
  status: 429,
  code: 'over_request_rate_limit'
}
 [AuthApiError: Request rate limit reached] {
  __isAuthError: true,
  name: 'AuthApiError',
  status: 429,
  code: 'over_request_rate_limit'
}
 [AuthApiError: Request rate limit reached] {
  __isAuthError: true,
  name: 'AuthApiError',
  status: 429,
  code: 'over_request_rate_limit'
}

```

---

## Windows Event Log (Application)

- No matching Application log events in last 3 hours

---

## Classification guide

| Cause | Indicators |
| ----- | ---------- |
| Out of memory | Exit 134/137, heap near limit, V8 OOM message |
| Native module | Access violation 0xC0000005, no OOM |
| Prisma engine | Rust panic in stderr, query engine crash |
| Unhandled rejection | Node warning before exit code 1 |
| Event loop starvation | Extreme lag, no crash |

*Raw: `docs/.load-investigation-results.json` → `crash`*
