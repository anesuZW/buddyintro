# Private Beta — Messaging Validation

**Team:** Prompt 4  
**Date:** 2026-08-02

## Verified / fixed

| Area | Status | Notes |
|------|--------|-------|
| Conversation list | OK | Load + cursor pagination |
| Sending | OK | Optimistic send + reconcile |
| Receiving (realtime) | OK | INSERT subscription |
| Chat switch bleed | **Fixed** | `ChatWindow key={other.id}` + reset state in hook |
| Optimistic + realtime duplicate | **Fixed** | Replace `tmp-*` on matching INSERT |
| Thread pagination cursor | **Fixed** | Oldest timestamp used for `nextCursor` |
| Initial thread depth | **Improved** | Fetch limit 50 (was 20) |
| Unread while chat open | **Fixed** | `POST /api/messages/read` on inbound INSERT |
| Reconnect backfill | **Fixed** | Reload on `SUBSCRIBED` |
| Story video reply preview | **Fixed** | `<video>` when mediaType=video |
| Images as message type | N/A | Not a product feature |
| Read receipts (ticks) | N/A | Not implemented; unread counts only |
| Typing indicators | N/A | Not implemented |

## Residual

| Item | Severity |
|------|----------|
| No UI “load older messages” beyond 50 | Medium |
| Typing / delivery ticks | Low (product) |

## Sign-off

Conversations are **dependable for private beta**. Genuine bugs above fixed.
