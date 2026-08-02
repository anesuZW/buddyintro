# Production database audit (READ ONLY)

| File | Purpose |
|------|---------|
| `DATABASE_DIFF.md` | Live DB vs `schema.prisma` / migrations |
| `MIGRATION_STATUS.md` | `_prisma_migrations` history |
| `SAFETY_REPORT.md` | Additive-only safety + verdict |
| `SAFE_MIGRATION.sql` | Generated SQL — **not executed** |
| `artifacts/` | Raw audit JSON + empty `prisma-migrate-diff.sql` |

**Verdict:** see `SAFETY_REPORT.md` → **SAFE TO APPLY**
