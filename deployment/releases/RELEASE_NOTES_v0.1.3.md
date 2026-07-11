# BuddyIntro v0.1.3

Released: 2026-07-11

## Features
- None

## Bug fixes
- None

## Performance improvements
- None

## Security improvements
- None

## Database changes
- None

## Deployment notes

- Node.js >= 18.17.0
- Run `npx prisma migrate deploy` after deploy
- Restart Passenger: `touch tmp/restart.txt`
- Verify: `curl /api/health`

## Other changes
- Improve cross-platform release and deployment tooling (71b94c3, Anesu Gozo)
