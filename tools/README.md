# BuddyIntro — Development Tools

This folder holds **non-production** utilities. Nothing here is required at runtime on Passenger.

| Directory | Purpose |
| --------- | ------- |
| `benchmarks/` | Load tests, SSR profilers, scale progression |
| `audits/` | Route, navigation, performance, and database audits |
| `dev/` | Simulation validation, concurrency stress tests |

Production operations live in `/scripts` (release, health, backup, job worker).

Run via `npm run` — see root `package.json` for aliases pointing to `tools/`.
