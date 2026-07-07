# BuddyIntro v0.1.1

Released: 2026-07-07

## Features
- Add automated release and deployment pipeline (2498a92, Anesu Gozo)

## Bug fixes
- Fix Prisma configuration for InterServer (91f7251, Anesu Gozo)

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
- Release v0.1.1 (ba48ed9, Anesu Gozo)
- Update package (39d3fcf, Anesu Gozo)
- Update package lock (455e142, Anesu Gozo)
- Initial BuddyIntro production release (b7547e4, Anesu Gozo)
