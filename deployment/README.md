# BuddyIntro Deployment

Production packaging and release artifacts.

| Path | Purpose |
| ---- | ------- |
| `package.js` | Builds production ZIP in `releases/` |
| `releases/` | Generated `BuddyIntro-vX.Y.Z.zip` files (gitignored) |
| `staging/` | Temporary assembly directory (gitignored) |
| `templates/README_DEPLOY.md` | Copied into each release package |

## Quick start

```bash
npm run build
npm run package
# → deployment/releases/BuddyIntro-v0.1.0.zip
```

See `docs/deployment/PASSENGER.md` for InterServer hosting steps.
