# RC1 Regression Results

**Generated:** 2026-07-26T15:46:50.801Z  
**Script:** `npx tsx scripts/rc1-api-smoke.ts`

---

## Result

**PASS ✅**





---

## Output (tail)

```
✓ GET /api/messages/[userId]/context 200 9565ms
✓ POST /api/messages 200 5186ms
✓ GET /api/feed unauthenticated → 401
✓ GET /api/discoveries unauthenticated → 401
✓ GET /api/health public → 200
✓ GET /api/discoveries (posts) 200 5362ms
✓ POST like 200 7920ms
✓ POST like again (toggle) 200 3438ms
✓ POST bookmark 200 7508ms
✓ POST share 200 6042ms
✓ POST comment 201 9987ms
✓ POST /api/media/upload 200 4502ms

18/18 passed

```

Full log: `artifacts/rc1-output.txt`
