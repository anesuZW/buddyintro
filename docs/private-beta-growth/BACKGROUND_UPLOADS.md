# Background Uploads

**Sprint:** Private Beta UX + Growth  
**Date:** 2026-08-02

## Problem

Introduction media uploads blocked the composer. Oversized files could start uploading and fail late. Progress lived only inside `StoryUploader` and died on navigation.

## Solution

| Piece | Location |
|-------|----------|
| Immediate validation | `lib/media-client-validate.ts` |
| Shared XHR transport | `lib/upload-transport.ts` |
| Navigation-surviving manager | `components/uploads/UploadManagerProvider.tsx` |
| Floating upload dock | `components/uploads/UploadDock.tsx` |
| Ready-to-Share screen | `components/uploads/ReadyToShareScreen.tsx` |
| Composer integration | `components/stories/StoryUploader.tsx` |

## Behaviour

1. On file select → validate type, size, image dimensions, video duration **before** any network upload.
2. Oversize → friendly toast immediately, e.g.  
   `This file is 148 MB. BuddyIntro currently supports uploads up to 100 MB.`
3. On Publish → enqueue job; user is sent to Home; dock shows progress / Cancel / Hide.
4. Phone tags + relationship + caption persist in memory + IndexedDB draft (`bg-intro-*`).
5. At 100% → create story via `/api/stories` → open Ready-to-Share (phone invites) without re-asking for the number.

## Limits

| Limit | Value |
|-------|-------|
| Max file size | **100 MB** |
| Max video duration | **90 s** |
| Max image edge | **8192 px** |
| Nginx body | **101m** (`deployment/templates/nginx-buddyintro.conf`) |
| XHR timeout | **300 s** |

## Ops note

Production nginx must be reloaded with `client_max_body_size 101m` after deploy, or large uploads will still 413 at the proxy.
