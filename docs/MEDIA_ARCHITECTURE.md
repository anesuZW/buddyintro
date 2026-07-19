# Media Architecture (Platform Hardening v2)

BuddyIntro media is served through a **StorageProvider** abstraction. Application code calls `getStorageProvider()` — switching `MEDIA_PROVIDER` does not require app changes.

## Providers

| Provider | Env value | Notes |
|----------|-----------|-------|
| Local disk | `local` (default) | VPS / standalone deployments |
| Supabase Storage | `supabase` | Existing Supabase bucket passthrough |
| AWS S3 | `s3` | `MEDIA_S3_*` env vars |
| Backblaze B2 | `backblaze` | `MEDIA_B2_*` env vars |
| Cloudflare R2 | `cloudflare-r2` | `MEDIA_R2_*` env vars |

## Filesystem layout

New uploads use a date-sharded hierarchy:

```
uploads/
  images/YYYY/MM/{userId}/{id}.webp
  videos/YYYY/MM/{userId}/{id}.mp4
  audio/YYYY/MM/{userId}/{id}.webm
  thumbnails/YYYY/MM/{userId}/{stem}.webp
```

Legacy paths (`{userId}/{kind}/...` and `thumbnails/{userId}/video/...`) remain readable and deletable.

Path generation lives in `lib/storage/paths.ts`.

## Image pipeline

Background worker generates WebP variants via Sharp:

| Variant | Width |
|---------|-------|
| tiny | 64px |
| thumb | 200px |
| medium | 800px |
| large | 1600px |
| original | optimized full size |

Quality: `MEDIA_WEBP_QUALITY` (default `82`).

## Video pipeline

When `ffmpeg` is available:

- Original (stored on upload)
- Transcodes: 480p, 720p, 1080p
- Thumbnail + poster WebP

If `ffmpeg` is missing, upload still succeeds; transcoding is skipped with a warning.

## Upload flow

1. Client → `POST /api/media/upload`
2. Provider stores original bytes immediately
3. `MediaObject` row created (SHA-256 dedup + ref counting)
4. Background job queued (`media.process`)
5. API returns success with `processingStatus: pending`

## Background worker

- **BullMQ** when `REDIS_URL` is set: `npm run media-worker`
- **Prisma job queue** fallback when Redis is unavailable

Job types:

- `media.process` — Sharp/ffmpeg optimization (idempotent per `mediaObjectId`)
- `media.cleanup` — orphan file cleanup

General app jobs continue via `npm run job-worker`.

## Duplicate detection

Uploaded bytes are hashed (SHA-256). Identical content reuses the existing `MediaObject`, increments `refCount`, and skips duplicate storage.

Files are deleted only when `refCount` reaches zero.

## Orphan cleanup

Run nightly:

```bash
npm run media:cleanup
# dry run
npm run media:cleanup -- --dry-run
```

Deletes unreferenced files older than 24 hours. Never deletes paths referenced in users, stories, discoveries, or `media_objects`.

## CDN / caching

Local files are served at `/uploads/...` with:

- `Cache-Control: public, max-age=31536000, immutable`
- `ETag` support (304 responses)

Filenames include timestamp + random id for cache busting on new uploads.

## Backups

Optional nightly incremental sync:

```bash
MEDIA_BACKUP_PROVIDER=backblaze  # or r2
npm run media:backup
```

Uses S3-compatible APIs; does not block the application.

## Admin analytics

`GET /api/admin/storage` and `/maindash/storage` expose:

- Total storage / file counts by type
- Processing queue status
- Largest users and daily upload trends

## Migration guide

1. Apply migration `0008_media_platform`
2. Run `npx prisma generate`
3. Start `npm run media-worker` (or enable Redis + BullMQ)
4. Schedule `npm run media:cleanup` nightly
5. Existing media URLs keep working — no bulk migration required

## Production checklist

- [ ] `MEDIA_ROOT` on persistent disk outside deploy directory
- [ ] `ffmpeg` installed for video variants
- [ ] `media-worker` running (systemd/cron)
- [ ] `media:cleanup` scheduled nightly
- [ ] Optional `MEDIA_BACKUP_PROVIDER` configured
- [ ] Optional `REDIS_URL` for BullMQ throughput
