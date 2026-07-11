# Changelog

All notable changes to BuddyIntro are documented here.

Release notes are auto-generated during `npm run publish`.

## v0.1.3

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

## v0.1.1

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
- Update package (39d3fcf, Anesu Gozo)
- Update package lock (455e142, Anesu Gozo)
- Initial BuddyIntro production release (b7547e4, Anesu Gozo)
