# Production Services Architecture

This document covers voice notes, media uploads, and invitation emails — the three production service paths audited for reliability and observability.

---

## Issue summaries (root causes)

| Issue | Root cause | Permanent fix |
|-------|------------|---------------|
| Voice recommendation broken | `Permissions-Policy: microphone=()` blocked `getUserMedia` | Changed to `microphone=(self)` in `next.config.js` and `lib/security.ts` |
| Upload failed (413) | Nginx default `client_max_body_size` is **1 MB**; app allows **25 MB** | Added `deployment/templates/nginx-buddyintro.conf` with `client_max_body_size 25m` |
| Invitation emails never arrive | `sendEmail()` returned `{ ok: false }` silently; callers ignored result | Structured logging + `emailDelivery[]` in API + frontend warning |

---

## 1. Voice note architecture

Voice recommendations are optional audio attachments on introductions (stories).

```
StoryUploader (step 3)
  → useMediaRecorder (getUserMedia + MediaRecorder)
  → Blob (webm or mp4 on Safari)
  → useUpload → POST /api/media/upload (kind=audio)
  → StorageProvider (local / Supabase / S3)
  → POST /api/stories { voiceNoteUrl }
  → stories.voice_note_url
```

### Key files

| File | Role |
|------|------|
| `components/stories/StoryUploader.tsx` | UI + publish flow |
| `hooks/useMediaRecorder.ts` | Recording state, errors, max 120s |
| `lib/media-recorder.ts` | MIME selection (webm → mp4 fallback) |
| `app/api/media/upload/route.ts` | Auth + size check + storage |
| `components/stories/StoryPlayer.tsx` | Playback (unmuted for image + voice) |

### Browser requirements

- `Permissions-Policy` must include `microphone=(self)`
- User must grant microphone permission
- Safari prefers `audio/mp4`; Chrome/Firefox use `audio/webm`

### Verify

```bash
npm run verify:audio
npm run verify:audio -- --url=https://your-domain.com
```

---

## 2. Upload architecture

Introduction publish uploads media **before** creating the story JSON.

```
Browser FormData
  → Nginx (client_max_body_size 25m)   ← 413 if missing/wrong
  → Next.js POST /api/media/upload
  → MAX_UPLOAD_BYTES (25 MB) check
  → StorageProvider.upload(buffer)
  → { url, path } returned
  → POST /api/stories (URLs only, small JSON)
```

### Size limits (every layer)

| Layer | Limit | Config location |
|-------|-------|-----------------|
| Nginx | **25m** (required) | `deployment/templates/nginx-buddyintro.conf` |
| App API | 25 MB | `lib/constants.ts` → `MAX_UPLOAD_BYTES` |
| Server Actions | 25mb | `next.config.js` (not used for media upload route) |
| Client pre-check | 25 MB | `hooks/useUpload.ts` |

### 413 diagnosis

| Response | Meaning |
|----------|---------|
| HTML “413 Request Entity Too Large” | Reverse proxy limit — fix nginx |
| JSON `{ code: "proxy_body_limit" }` | Body truncated before Next.js parsed multipart |
| JSON `{ code: "app_body_limit" }` | File exceeds 25 MB app limit |

### Verify

```bash
npm run verify:upload
```

After nginx config change:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 3. Email architecture

Invitation emails send **synchronously** during story creation (not queued).

```
POST /api/stories (external email tag)
  → createStoryWithTags()
  → createInvitation() + storyTag
  → sendInvitationEmail()
  → sendEmail() — Resend primary, SMTP fallback
  → structured log (recipient, provider, messageId)
  → API returns emailDelivery[]
  → StoryUploader toast if any failed
```

### Required environment

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Primary provider |
| `EMAIL_FROM` | Verified sender address |
| `NEXT_PUBLIC_APP_URL` | Links in email body |
| `SMTP_*` | Optional fallback |

### Logging

Every send logs via `appLogger` with:

- `recipient`, `provider`, `messageId`, `type`, `error`, `statusCode`

Search production logs for:

- `invitation email failed`
- `no email provider configured`
- `Resend send failed`

### Deliverability (DNS — outside app)

- SPF, DKIM, DMARC on sending domain
- Domain verified in Resend dashboard

### Verify

```bash
npm run verify:email
```

---

## Combined health check

```bash
npm run production:health
npm run production:health -- --url=https://your-domain.com
```

Checks:

- Environment variable presence (never secrets)
- Voice recording policy + media root
- Upload limits + nginx template + `/api/health`
- Email provider configuration

---

## Recovery procedures

### Voice recording still fails

1. `npm run verify:audio`
2. Browser devtools → check `Permissions-Policy` response header includes `microphone=(self)`
3. Confirm user granted mic permission
4. Check upload logs for `kind=audio` in PM2 logs

### Upload 413 persists

1. `npm run verify:upload`
2. On VPS: `grep client_max_body_size /etc/nginx/sites-enabled/*`
3. Set `client_max_body_size 25m;` and reload nginx
4. If JSON `app_body_limit`, file exceeds 25 MB — compress or raise limits consistently

### Invitation emails not received

1. `npm run verify:email`
2. PM2 logs: `grep "invitation email" shared/logs/pm2-out.log`
3. Resend dashboard → verify domain + check bounces
4. Confirm tagged email is **not** already a registered user (no invite email in that case)
5. API response `emailDelivery` array shows per-recipient status

---

## Proof — invitation email provider responses

When `sendEmail()` returns `{ ok: false }`, the exact provider rejection is captured in structured logs and in the API `emailDelivery[]` payload.

### Where to look

| Source | Field | Contents |
|--------|-------|----------|
| PM2 logs (`shared/logs/pm2-out.log`) | `providerError` | Full Resend/SMTP rejection |
| PM2 logs | `providerResponse` | Success `{ status: "accepted", messageId }` |
| API `POST /api/stories` response | `emailDelivery[].providerError` | Same object returned to client |
| Resend dashboard | Message log | Cross-check `messageId` on success |

### Log messages (grep)

```bash
grep -E 'invitation email failed|Resend send failed|Resend API rejected|SMTP send failed|no email provider' shared/logs/pm2-out.log
```

### Example — Resend domain not verified (typical production failure)

**PM2 log (JSON):**

```json
{
  "level": "error",
  "msg": "invitation email failed",
  "route": "stories/create",
  "email": "friend@example.com",
  "error": "The buddyintro.com domain is not verified",
  "statusCode": 403,
  "providerError": {
    "provider": "resend",
    "message": "The buddyintro.com domain is not verified",
    "statusCode": 403,
    "name": "validation_error"
  }
}
```

**API response fragment:**

```json
{
  "emailDelivery": [{
    "email": "friend@example.com",
    "ok": false,
    "error": "The buddyintro.com domain is not verified",
    "statusCode": 403,
    "providerError": {
      "provider": "resend",
      "message": "The buddyintro.com domain is not verified",
      "statusCode": 403,
      "name": "validation_error"
    }
  }]
}
```

This is the exact reason `sendEmail()` returned `{ ok: false }` — not a silent drop.

### Example — no provider configured

```json
{
  "level": "warn",
  "msg": "no email provider configured",
  "providerError": {
    "provider": null,
    "message": "No email provider configured (set RESEND_API_KEY or SMTP_HOST/SMTP_PORT)"
  }
}
```

### Example — SMTP fallback rejection

When Resend fails and SMTP also fails, both errors are logged:

```json
{
  "level": "error",
  "msg": "SMTP fallback failed",
  "providerError": {
    "provider": "smtp",
    "message": "Invalid login: 535 Authentication failed",
    "statusCode": 535,
    "code": "EAUTH",
    "response": "535 5.7.8 Authentication failed"
  },
  "resendProviderError": {
    "provider": "resend",
    "message": "...",
    "statusCode": 403
  }
}
```

### Example — successful send (proof of delivery attempt)

```json
{
  "level": "info",
  "msg": "invitation email sent",
  "provider": "resend",
  "messageId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "providerResponse": { "status": "accepted", "messageId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
}
```

---

## Proof — HTTP 413 origin (Nginx vs app)

Three distinct 413 scenarios. Only one originates inside Next.js.

### Decision table

| Symptom | Response body | Response headers | PM2 log | Origin |
|---------|---------------|------------------|---------|--------|
| **Nginx blocks before app** | HTML page: `413 Request Entity Too Large` | `Server: nginx` — **no** `X-Upload-Reject-Source` | **No** `upload request received` log | **Nginx** |
| **Proxy truncates body** | JSON `{ "code": "proxy_body_limit" }` | `X-Upload-Reject-Source: proxy` | `upload formData parse failed` | **Nginx/Apache** (1m default) |
| **App size check** | JSON `{ "code": "app_body_limit" }` | `X-Upload-Reject-Source: app` | `upload rejected with 413` + `rejectSource: "app"` | **Next.js app** |

### Proof that 413 is Nginx (not the app)

**1. Browser Network tab**

- Status: `413`
- Response: **HTML** (not JSON)
- Response headers: **missing** `X-Upload-Reject-Source` and `X-Upload-Reject-Code`
- `Content-Type`: often `text/html`

**2. PM2 logs — request never reached the app**

```bash
grep 'upload request received' shared/logs/pm2-out.log
# No line at the failure timestamp → nginx rejected before Next.js
```

When nginx rejects at `client_max_body_size`, the Node process never sees the request.

**3. Nginx error log — definitive proof**

```bash
sudo grep 'client intended to send too large body' /var/log/nginx/error.log
```

Example nginx error line:

```
2026/07/24 12:00:00 [error] 1234#0: *567 client intended to send too large body: 2457600 bytes,
client: 203.0.113.10, server: buddyintro.com, request: "POST /api/media/upload HTTP/1.1"
```

This confirms nginx — not Next.js, not PM2, not Cloudflare (unless Cloudflare is the edge returning HTML 413).

**4. After nginx fix — app receives upload**

Once `client_max_body_size 25m;` is applied:

```json
{ "level": "info", "msg": "upload request received", "route": "media/upload", "contentLength": 2457600 }
{ "level": "info", "msg": "upload started", "route": "media/upload", "kind": "image", "bytes": 2457600 }
{ "level": "info", "msg": "upload complete", "route": "media/upload", "path": "images/2026/07/..." }
```

### Proof that 413 is the app (not nginx)

```json
{
  "level": "warn",
  "msg": "upload rejected with 413",
  "rejectSource": "app",
  "code": "app_body_limit",
  "bytes": 27000000,
  "maxBytes": 26214400
}
```

Response headers: `X-Upload-Reject-Source: app`, `X-Upload-Reject-Code: app_body_limit`

Response JSON: `{ "code": "app_body_limit", "limitMb": 25, "rejectSource": "app" }`

### Proof that 413 is proxy truncation (nginx passed partial body)

```json
{
  "level": "error",
  "msg": "upload formData parse failed — body likely truncated by reverse proxy",
  "rejectSource": "proxy",
  "contentLength": 2457600,
  "proof": "Request reached Next.js but multipart body could not be parsed; nginx/apache default 1m limit is the usual cause"
}
```

Response headers: `X-Upload-Reject-Source: proxy`, `X-Upload-Reject-Code: proxy_body_limit`

### curl proof commands

**Detect nginx HTML 413 (no app involvement):**

```bash
# Create a 2MB test file (> nginx 1m default)
dd if=/dev/zero of=/tmp/test-upload.bin bs=1M count=2

curl -sS -o /tmp/upload-response.txt -w '%{http_code}\n' \
  -X POST https://your-domain.com/api/media/upload \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -F "file=@/tmp/test-upload.bin" \
  -F "kind=image"

head -5 /tmp/upload-response.txt
# HTML containing "413 Request Entity Too Large" → nginx
# JSON with "code" field → app or proxy layer inside Next.js
```

**Confirm nginx config on server:**

```bash
grep -r client_max_body_size /etc/nginx/
# Must show: client_max_body_size 25m;
```

---

## Related scripts

| Script | Purpose |
|--------|---------|
| `scripts/verify-audio.js` | Voice note prerequisites |
| `scripts/verify-upload.js` | Upload limits + connectivity |
| `scripts/verify-email.js` | Email provider env |
| `scripts/production-health.js` | All of the above |
| `deployment/templates/nginx-buddyintro.conf` | Production nginx template |
