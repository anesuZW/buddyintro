# BuddyIntro Simulation Report

Generated: 2026-06-22T22:51:16.056Z

## Summary

| Check | Result |
| ----- | ------ |
| Seed completed | ✓ |
| Validation | **PASS** |
| Users validated | 1000 |
| Passed | 1000 |
| Failed | 0 |

## Record counts

| Entity | Target | Actual |
| ------ | ------ | ------ |
| Users | 1,000 | 1,000 |
| Trust relationships (`user_connections`) | 15,000 | 999,000 |
| Tagged stories | 10,000 | 10,000 |
| Published stories | — | 7,000 |
| Draft introduction requests | 3,000 | 3,000 |
| Discovery posts | 5,000 | 5,000 |
| Messages | 10,000 | 10,000 |
| Notifications | 15,000 | 15,000 |
| Shared introducer rows | — | 41,431 |

## Graph metrics

| Metric | Value |
| ------ | ----- |
| Graph density (connections / n×(n−1)) | 1.000000 |
| Average trust degree (connections per source user) | 997 |
| Feed coverage (users with outgoing intros) | 1000 / 1000 (100%) |
| Recommendation coverage (≥2 shared introducers) | 518 / 1000 (52%) |
| Introduction coverage (sent or received) | 1000 / 1000 (100%) |

## Slowest queries (smoke test)

| Query | ms |
| --- | --- |
| sharedIntroducerRelationship.findMany | 132 |
| discoveriesPost.findMany (network) | 8 |
| userConnection.findMany (degree<=2) | 6 |
| story introductions inbox | 5 |

## Validation failures

No global errors.

No per-user failures in sample.

## Persona & graph design

> **Note:** user_connections rows are materialized BFS paths (up to degree 4), so actual counts exceed the sparse edge target (~15k at 1,000 users is a design guide; expect ~30k–80k depending on cluster density).

- **Regions:** Zimbabwe, South Africa, Botswana, Kenya, Nigeria, UK diaspora
- **Structure:** 20 industry/regional communities (~45 members) + 100 bridge users
- **Stories:** intra-community introductions + cross-community bridge intros (not fully connected)
- **Login:** `sim-0@simulation.buddyintro.test` … `sim-999@simulation.buddyintro.test` / password `SimPass123!`

## Commands

```bash
npm run seed:simulation
npm run seed:simulation -- --reset
npm run seed:simulation -- --users=100   # scaled smoke test
```
