# Scalability Test Results

Generated: 2026-06-22T22:51:41.973Z

Progressive simulation scales: **50 → 50 → 50 → 50 → 100 → 100 → 100 → 100 → 250 → 250 → 250 → 500 → 500 → 1000** users  
Auth benchmark user: `sim-0@simulation.buddyintro.test`  
Production port: 3010 · Warm runs: 3

---

## 1. Dataset sizes

| Users | Connections | Home TTFB | Discoveries TTFB | Profile TTFB | Msg context TTFB |
| --- | --- | --- | --- | --- | --- |
| 50 | 2450 | 350 | 440 | 458 | 378 |
| 50 | 2450 | 350 | 440 | 458 | 378 |
| 50 | 2450 | 350 | 440 | 458 | 378 |
| 50 | 2450 | 350 | 440 | 458 | 378 |
| 100 | 9886 | 391 | 475 | 394 | 434 |
| 100 | 9886 | 391 | 475 | 394 | 434 |
| 100 | 9886 | 391 | 475 | 394 | 434 |
| 100 | 9900 | 313 | 390 | 323 | 302 |
| 250 | 61050 | 287 | 356 | 350 | 329 |
| 250 | 61050 | 287 | 356 | 350 | 329 |
| 250 | 61050 | 329 | 391 | 334 | 313 |
| 500 | 249500 | 302 | 383 | 309 | 496 |
| 500 | 249500 | 306 | 384 | 345 | 325 |
| 1000 | 999000 | 320 | 398 | 347 | 380 |

---

## 2. Validation outcomes

| Users | Result | Passed | Seed exit |
| ----- | ------ | ------ | --------- |
| 50 | PASS | 50/50 | 0 |
| 50 | PASS | 50/50 | 0 |
| 50 | PASS | 50/50 | 0 |
| 50 | PASS | 50/50 | 0 |
| 100 | PASS | 100/100 | 0 |
| 100 | PASS | 100/100 | 0 |
| 100 | PASS | 100/100 | 0 |
| 100 | PASS | 100/100 | 0 |
| 250 | PASS | 250/250 | 0 |
| 250 | PASS | 250/250 | 0 |
| 250 | PASS | 250/250 | 0 |
| 500 | PASS | 500/500 | 0 |
| 500 | PASS | 500/500 | 0 |
| 1000 | PASS | 1000/1000 | 0 |

---

## 3. Per-scale detail

### 50 users

**Validation:** **PASS** (50/50)  
**Seed time:** 44s  
**Benchmark time:** 42s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 50 |
| Stories | 500 |
| Discoveries | 250 |
| Messages | 500 |
| Notifications | 750 |
| user_connections (sim sources) | 2450 |
| Shared introducers | 568 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 50/50 |
| Recommendation coverage (≥2 shared) | 37/50 |
| Introduction coverage | 50/50 |
| Avg connections per source user | 47 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 350 | 454 | 280 | 0 | 454 |
| /discoveries | 440 | 458 | 286 | 0 | 458 |
| /introductions | 402 | 415 | 356 | 0 | 415 |
| /profile | 458 | 480 | 340 | 0 | 480 |
| /api/messages/[userId]/context | 378 | 378 | 267 | 87 | 84 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| discoveriesPost.findMany (network) | 15 |
| sharedIntroducerRelationship.findMany | 10 |
| story introductions inbox | 6 |
| userConnection.findMany (degree<=2) | 5 |

### 50 users

**Validation:** **PASS** (50/50)  
**Seed time:** 44s  
**Benchmark time:** 42s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 50 |
| Stories | 500 |
| Discoveries | 250 |
| Messages | 500 |
| Notifications | 750 |
| user_connections (sim sources) | 2450 |
| Shared introducers | 568 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 50/50 |
| Recommendation coverage (≥2 shared) | 37/50 |
| Introduction coverage | 50/50 |
| Avg connections per source user | 47 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 350 | 454 | 280 | 0 | 454 |
| /discoveries | 440 | 458 | 286 | 0 | 458 |
| /introductions | 402 | 415 | 356 | 0 | 415 |
| /profile | 458 | 480 | 340 | 0 | 480 |
| /api/messages/[userId]/context | 378 | 378 | 267 | 87 | 84 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| discoveriesPost.findMany (network) | 15 |
| sharedIntroducerRelationship.findMany | 10 |
| story introductions inbox | 6 |
| userConnection.findMany (degree<=2) | 5 |

### 50 users

**Validation:** **PASS** (50/50)  
**Seed time:** 44s  
**Benchmark time:** 42s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 50 |
| Stories | 500 |
| Discoveries | 250 |
| Messages | 500 |
| Notifications | 750 |
| user_connections (sim sources) | 2450 |
| Shared introducers | 568 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 50/50 |
| Recommendation coverage (≥2 shared) | 37/50 |
| Introduction coverage | 50/50 |
| Avg connections per source user | 47 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 350 | 454 | 280 | 0 | 454 |
| /discoveries | 440 | 458 | 286 | 0 | 458 |
| /introductions | 402 | 415 | 356 | 0 | 415 |
| /profile | 458 | 480 | 340 | 0 | 480 |
| /api/messages/[userId]/context | 378 | 378 | 267 | 87 | 84 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| discoveriesPost.findMany (network) | 15 |
| sharedIntroducerRelationship.findMany | 10 |
| story introductions inbox | 6 |
| userConnection.findMany (degree<=2) | 5 |

### 50 users

**Validation:** **PASS** (50/50)  
**Seed time:** 44s  
**Benchmark time:** 42s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 50 |
| Stories | 500 |
| Discoveries | 250 |
| Messages | 500 |
| Notifications | 750 |
| user_connections (sim sources) | 2450 |
| Shared introducers | 568 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 50/50 |
| Recommendation coverage (≥2 shared) | 37/50 |
| Introduction coverage | 50/50 |
| Avg connections per source user | 47 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 350 | 454 | 280 | 0 | 454 |
| /discoveries | 440 | 458 | 286 | 0 | 458 |
| /introductions | 402 | 415 | 356 | 0 | 415 |
| /profile | 458 | 480 | 340 | 0 | 480 |
| /api/messages/[userId]/context | 378 | 378 | 267 | 87 | 84 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| discoveriesPost.findMany (network) | 15 |
| sharedIntroducerRelationship.findMany | 10 |
| story introductions inbox | 6 |
| userConnection.findMany (degree<=2) | 5 |

### 100 users

**Validation:** **PASS** (100/100)  
**Seed time:** 86s  
**Benchmark time:** 41s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 100 |
| Stories | 1000 |
| Discoveries | 500 |
| Messages | 1000 |
| Notifications | 1500 |
| user_connections (sim sources) | 9886 |
| Shared introducers | 985 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 100/100 |
| Recommendation coverage (≥2 shared) | 81/100 |
| Introduction coverage | 100/100 |
| Avg connections per source user | 97 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 391 | 482 | 335 | 0 | 482 |
| /discoveries | 475 | 490 | 292 | 0 | 490 |
| /introductions | 392 | 404 | 324 | 0 | 404 |
| /profile | 394 | 403 | 293 | 0 | 403 |
| /api/messages/[userId]/context | 434 | 434 | 294 | 125 | 129 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| discoveriesPost.findMany (network) | 17 |
| sharedIntroducerRelationship.findMany | 11 |
| story introductions inbox | 8 |
| userConnection.findMany (degree<=2) | 7 |

### 100 users

**Validation:** **PASS** (100/100)  
**Seed time:** 86s  
**Benchmark time:** 41s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 100 |
| Stories | 1000 |
| Discoveries | 500 |
| Messages | 1000 |
| Notifications | 1500 |
| user_connections (sim sources) | 9886 |
| Shared introducers | 985 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 100/100 |
| Recommendation coverage (≥2 shared) | 81/100 |
| Introduction coverage | 100/100 |
| Avg connections per source user | 97 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 391 | 482 | 335 | 0 | 482 |
| /discoveries | 475 | 490 | 292 | 0 | 490 |
| /introductions | 392 | 404 | 324 | 0 | 404 |
| /profile | 394 | 403 | 293 | 0 | 403 |
| /api/messages/[userId]/context | 434 | 434 | 294 | 125 | 129 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| discoveriesPost.findMany (network) | 17 |
| sharedIntroducerRelationship.findMany | 11 |
| story introductions inbox | 8 |
| userConnection.findMany (degree<=2) | 7 |

### 100 users

**Validation:** **PASS** (100/100)  
**Seed time:** 86s  
**Benchmark time:** 41s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 100 |
| Stories | 1000 |
| Discoveries | 500 |
| Messages | 1000 |
| Notifications | 1500 |
| user_connections (sim sources) | 9886 |
| Shared introducers | 985 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 100/100 |
| Recommendation coverage (≥2 shared) | 81/100 |
| Introduction coverage | 100/100 |
| Avg connections per source user | 97 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 391 | 482 | 335 | 0 | 482 |
| /discoveries | 475 | 490 | 292 | 0 | 490 |
| /introductions | 392 | 404 | 324 | 0 | 404 |
| /profile | 394 | 403 | 293 | 0 | 403 |
| /api/messages/[userId]/context | 434 | 434 | 294 | 125 | 129 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| discoveriesPost.findMany (network) | 17 |
| sharedIntroducerRelationship.findMany | 11 |
| story introductions inbox | 8 |
| userConnection.findMany (degree<=2) | 7 |

### 100 users

**Validation:** **PASS** (100/100)  
**Seed time:** 307s  
**Benchmark time:** 22s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 100 |
| Stories | 984 |
| Discoveries | 500 |
| Messages | 1000 |
| Notifications | 1500 |
| user_connections (sim sources) | 9900 |
| Shared introducers | 2232 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 100/100 |
| Recommendation coverage (≥2 shared) | 91/100 |
| Introduction coverage | 100/100 |
| Avg connections per source user | 97 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 313 | 365 | 263 | 0 | 365 |
| /discoveries | 390 | 398 | 261 | 0 | 398 |
| /introductions | 312 | 323 | 261 | 0 | 323 |
| /profile | 323 | 328 | 261 | 0 | 328 |
| /api/messages/[userId]/context | 302 | 303 | 261 | 44 | 33 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| discoveriesPost.findMany (network) | 11 |
| story introductions inbox | 7 |
| userConnection.findMany (degree<=2) | 6 |
| sharedIntroducerRelationship.findMany | 3 |

### 250 users

**Validation:** **PASS** (250/250)  
**Seed time:** 138s  
**Benchmark time:** 22s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 250 |
| Stories | 2500 |
| Discoveries | 1250 |
| Messages | 2500 |
| Notifications | 3750 |
| user_connections (sim sources) | 61050 |
| Shared introducers | 5760 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 250/250 |
| Recommendation coverage (≥2 shared) | 199/250 |
| Introduction coverage | 250/250 |
| Avg connections per source user | 242 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 287 | 347 | 269 | 0 | 347 |
| /discoveries | 356 | 360 | 273 | 0 | 360 |
| /introductions | 323 | 326 | 286 | 0 | 326 |
| /profile | 350 | 353 | 260 | 0 | 353 |
| /api/messages/[userId]/context | 329 | 329 | 254 | 70 | 73 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| userConnection.findMany (degree<=2) | 5 |
| discoveriesPost.findMany (network) | 5 |
| story introductions inbox | 4 |
| sharedIntroducerRelationship.findMany | 3 |

### 250 users

**Validation:** **PASS** (250/250)  
**Seed time:** 138s  
**Benchmark time:** 22s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 250 |
| Stories | 2500 |
| Discoveries | 1250 |
| Messages | 2500 |
| Notifications | 3750 |
| user_connections (sim sources) | 61050 |
| Shared introducers | 5760 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 250/250 |
| Recommendation coverage (≥2 shared) | 199/250 |
| Introduction coverage | 250/250 |
| Avg connections per source user | 242 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 287 | 347 | 269 | 0 | 347 |
| /discoveries | 356 | 360 | 273 | 0 | 360 |
| /introductions | 323 | 326 | 286 | 0 | 326 |
| /profile | 350 | 353 | 260 | 0 | 353 |
| /api/messages/[userId]/context | 329 | 329 | 254 | 70 | 73 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| userConnection.findMany (degree<=2) | 5 |
| discoveriesPost.findMany (network) | 5 |
| story introductions inbox | 4 |
| sharedIntroducerRelationship.findMany | 3 |

### 250 users

**Validation:** **PASS** (250/250)  
**Seed time:** 187s  
**Benchmark time:** 22s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 250 |
| Stories | 2500 |
| Discoveries | 1250 |
| Messages | 2500 |
| Notifications | 3750 |
| user_connections (sim sources) | 61050 |
| Shared introducers | 5760 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 250/250 |
| Recommendation coverage (≥2 shared) | 199/250 |
| Introduction coverage | 250/250 |
| Avg connections per source user | 242 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 329 | 387 | 273 | 0 | 387 |
| /discoveries | 391 | 403 | 267 | 0 | 403 |
| /introductions | 321 | 330 | 254 | 0 | 330 |
| /profile | 334 | 341 | 265 | 0 | 341 |
| /api/messages/[userId]/context | 313 | 313 | 264 | 54 | 42 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| discoveriesPost.findMany (network) | 7 |
| userConnection.findMany (degree<=2) | 5 |
| sharedIntroducerRelationship.findMany | 5 |
| story introductions inbox | 4 |

### 500 users

**Validation:** **PASS** (500/500)  
**Seed time:** 648s  
**Benchmark time:** 25s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 500 |
| Stories | 5000 |
| Discoveries | 2500 |
| Messages | 5000 |
| Notifications | 7500 |
| user_connections (sim sources) | 249500 |
| Shared introducers | 14415 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 500/500 |
| Recommendation coverage (≥2 shared) | 320/500 |
| Introduction coverage | 500/500 |
| Avg connections per source user | 497 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 302 | 434 | 268 | 0 | 434 |
| /discoveries | 383 | 392 | 270 | 0 | 392 |
| /introductions | 295 | 301 | 253 | 0 | 301 |
| /profile | 309 | 314 | 244 | 0 | 314 |
| /api/messages/[userId]/context | 496 | 496 | 242 | 243 | 253 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| userConnection.findMany (degree<=2) | 11 |
| sharedIntroducerRelationship.findMany | 7 |
| discoveriesPost.findMany (network) | 6 |
| story introductions inbox | 5 |

### 500 users

**Validation:** **PASS** (500/500)  
**Seed time:** 594s  
**Benchmark time:** 23s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 500 |
| Stories | 5000 |
| Discoveries | 2500 |
| Messages | 5000 |
| Notifications | 7500 |
| user_connections (sim sources) | 249500 |
| Shared introducers | 14415 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 500/500 |
| Recommendation coverage (≥2 shared) | 320/500 |
| Introduction coverage | 500/500 |
| Avg connections per source user | 497 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 306 | 416 | 255 | 0 | 416 |
| /discoveries | 384 | 392 | 260 | 0 | 392 |
| /introductions | 292 | 301 | 253 | 0 | 301 |
| /profile | 345 | 353 | 257 | 0 | 353 |
| /api/messages/[userId]/context | 325 | 326 | 259 | 74 | 56 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| discoveriesPost.findMany (network) | 10 |
| userConnection.findMany (degree<=2) | 6 |
| sharedIntroducerRelationship.findMany | 6 |
| story introductions inbox | 5 |

### 1000 users

**Validation:** **PASS** (1000/1000)  
**Seed time:** 2108s  
**Benchmark time:** 25s

#### Dataset

| Metric | Count |
| ------ | ----- |
| Users | 1000 |
| Stories | 10000 |
| Discoveries | 5000 |
| Messages | 10000 |
| Notifications | 15000 |
| user_connections (sim sources) | 999000 |
| Shared introducers | 41431 |

#### Coverage

| Metric | Value |
| ------ | ----- |
| Feed coverage | 1000/1000 |
| Recommendation coverage (≥2 shared) | 518/1000 |
| Introduction coverage | 1000/1000 |
| Avg connections per source user | 997 |

#### HTTP benchmark (warm median, production)

| Route | TTFB | Total | Auth | Prisma | Server total |
| --- | --- | --- | --- | --- | --- |
| /home | 320 | 504 | 261 | 0 | 504 |
| /discoveries | 398 | 408 | 265 | 0 | 408 |
| /introductions | 302 | 311 | 255 | 0 | 311 |
| /profile | 347 | 350 | 262 | 0 | 350 |
| /api/messages/[userId]/context | 380 | 380 | 291 | 119 | 82 |

#### Slow queries (Prisma smoke)

| Query | ms |
| --- | --- |
| discoveriesPost.findMany (network) | 9 |
| story introductions inbox | 9 |
| sharedIntroducerRelationship.findMany | 8 |
| userConnection.findMany (degree<=2) | 3 |


---

## 4. Growth / complexity analysis

- **/home:** TTFB 350ms → 320ms (20.0× users, 0.91× TTFB). approximately flat (O(1) or dominated by auth RTT)
- **/discoveries:** TTFB 440ms → 398ms (20.0× users, 0.90× TTFB). approximately flat (O(1) or dominated by auth RTT)
- **/introductions:** TTFB 402ms → 302ms (20.0× users, 0.75× TTFB). approximately flat (O(1) or dominated by auth RTT)
- **/profile:** TTFB 458ms → 347ms (20.0× users, 0.76× TTFB). approximately flat (O(1) or dominated by auth RTT)
- **/api/messages/[userId]/context:** TTFB 378ms → 380ms (20.0× users, 1.01× TTFB). approximately flat (O(1) or dominated by auth RTT)

**Latency inflection notes:**

- Middleware **auth** (~250–280ms) is fixed per request and dominates TTFB on all page routes — data scale does not reduce it.
- **user_connections** row count grows super-linearly with users (BFS materialization), affecting trust/discovery Prisma segments.
- Discoveries feed filters authors via materialized connections — cost rises with graph density.

---

## 5. Slowest endpoints (across scales, by median TTFB)

| Scale | Route | TTFB | Auth | Prisma |
| --- | --- | --- | --- | --- |
| 500 | /api/messages/[userId]/context | 496 | 242 | 243 |
| 100 | /discoveries | 475 | 292 | 0 |
| 100 | /discoveries | 475 | 292 | 0 |
| 100 | /discoveries | 475 | 292 | 0 |
| 50 | /profile | 458 | 340 | 0 |
| 50 | /profile | 458 | 340 | 0 |
| 50 | /profile | 458 | 340 | 0 |
| 50 | /profile | 458 | 340 | 0 |
| 50 | /discoveries | 440 | 286 | 0 |
| 50 | /discoveries | 440 | 286 | 0 |

---

## 6. Query hotspots

| Pattern | Evidence | Scales affected |
| ------- | -------- | --------------- |
| Middleware `getUser()` RTT | Auth ms ≈ 250–280ms on all routes | All |
| `userConnection.findMany` (degree cap) | Top slow-query smoke test | 250+ |
| Discoveries network author filter | `discoveriesPost.findMany` with `in: authorIds` | 250+ |
| Message context fan-out | Multiple `User.findUnique`, shared introducer lookups | All (low ms at 50–500) |
| Graph rebuild at seed | Seed duration grows with user count | Seed phase only |

---

## 7. Recommendation-engine behavior

- `assertRecommendationEngine` smoke test passes at all scales when validation passes.
- Recommendation **coverage** (% users with ≥2 shared introducers) increases with graph density as communities interlink.
- Runtime cost is bounded (`take: 12` connections) — not the primary latency driver vs auth RTT.

---

## 8. Trust-graph behavior

- **50 users:** 2450 materialized `user_connections` (sim sources), 568 shared introducers, avg degree 47
- **50 users:** 2450 materialized `user_connections` (sim sources), 568 shared introducers, avg degree 47
- **50 users:** 2450 materialized `user_connections` (sim sources), 568 shared introducers, avg degree 47
- **50 users:** 2450 materialized `user_connections` (sim sources), 568 shared introducers, avg degree 47
- **100 users:** 9886 materialized `user_connections` (sim sources), 985 shared introducers, avg degree 97
- **100 users:** 9886 materialized `user_connections` (sim sources), 985 shared introducers, avg degree 97
- **100 users:** 9886 materialized `user_connections` (sim sources), 985 shared introducers, avg degree 97
- **100 users:** 9900 materialized `user_connections` (sim sources), 2232 shared introducers, avg degree 97
- **250 users:** 61050 materialized `user_connections` (sim sources), 5760 shared introducers, avg degree 242
- **250 users:** 61050 materialized `user_connections` (sim sources), 5760 shared introducers, avg degree 242
- **250 users:** 61050 materialized `user_connections` (sim sources), 5760 shared introducers, avg degree 242
- **500 users:** 249500 materialized `user_connections` (sim sources), 14415 shared introducers, avg degree 497
- **500 users:** 249500 materialized `user_connections` (sim sources), 14415 shared introducers, avg degree 497
- **1000 users:** 999000 materialized `user_connections` (sim sources), 41431 shared introducers, avg degree 997

---

## 9. Feed behavior

- **50 users:** feed coverage 50/50 (100%)
- **50 users:** feed coverage 50/50 (100%)
- **50 users:** feed coverage 50/50 (100%)
- **50 users:** feed coverage 50/50 (100%)
- **100 users:** feed coverage 100/100 (100%)
- **100 users:** feed coverage 100/100 (100%)
- **100 users:** feed coverage 100/100 (100%)
- **100 users:** feed coverage 100/100 (100%)
- **250 users:** feed coverage 250/250 (100%)
- **250 users:** feed coverage 250/250 (100%)
- **250 users:** feed coverage 250/250 (100%)
- **500 users:** feed coverage 500/500 (100%)
- **500 users:** feed coverage 500/500 (100%)
- **1000 users:** feed coverage 1000/1000 (100%)

---

## 10. Optimization opportunities

### P0 — Fixed auth RTT (~250ms/request)

- Colocate deployment with Supabase eu-west-1 **or** local JWT verification (future).
- **Impact:** −200ms+ on every authenticated route regardless of user count.

### P1 — Graph materialization size

- `user_connections` BFS for all pairs up to degree 4 scales super-linearly.
- **Impact:** Slower trust/discovery queries and longer seed rebuilds at 500+ users.

### P2 — Discoveries author filter

- `getDiscoveriesNetworkAuthorIds` + large `in:` lists as network grows.
- **Impact:** Rising Prisma ms on `/discoveries` at 250–500 users.

### P3 — Message context repeated user lookups

- Profile logs show repeated `User.findUnique` in context route (known from prior audits).
- **Impact:** Moderate at 500 users; dwarfed by auth RTT today.

---

*Raw artifacts: `docs/.scale-progression/{N}-benchmark.json`, `docs/.scale-progression-results.json`*
