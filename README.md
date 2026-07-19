# FriendIntro

A social introduction platform — users introduce their friends to each other through Instagram-style stories that **must tag at least one person**. Visibility is scoped to *co-tagged* circles, so introductions stay intimate.

Built with **Next.js 14 (App Router)**, **TypeScript**, **TailwindCSS**, **Supabase** (auth, Postgres, storage, realtime) and **Prisma**.

---

## Features

- **Auth** — email/password, magic link, invite-link sign-up.
- **Stories** — image or video (mandatory) + optional voice note + optional caption + ≥1 tag.
- **Tagging** — tag existing users or anyone by email. External tags create invitations and the story stays a `draft` until they register; once they do, the story auto-publishes via a Postgres trigger.
- **Visibility** — a viewer sees an author's story only if they've been tagged by that same author in *some* story. Enforced both in queries and via Supabase RLS.
- **Messaging** — clicking a tagged person opens chat. Each message can carry a `story_reference`. Live updates via Supabase Realtime.
- **Mutual-tag feed** — surfaces posts/stories from people who share a tagged connection with you.
- **Invite gate (growth lever)** — admin toggle that requires a user to have invited N registered users before they can DM tagged people.
- **Admin** — settings page with stats and tunables (story expiry, post expiry, invite gate, required invites).
- **Modern UI** — mobile-first, dark/light mode, smooth Framer Motion animations.
- **Security** — Supabase RLS on every table, server-side Zod validation on all writes, service-role key strictly server-only.

---

## Project structure

```
.
├─ app/
│  ├─ (auth)/login, signup
│  ├─ (main)/home, stories, create-story, messages, profile, admin
│  ├─ auth/callback           # Supabase auth callback (sets session, accepts invite)
│  ├─ invite/[token]          # public invite landing page
│  └─ api/
│     ├─ auth/{bootstrap,logout}
│     ├─ stories, stories/[id]
│     ├─ users/search
│     ├─ messages
│     ├─ invites
│     ├─ posts
│     ├─ feed
│     ├─ profile
│     └─ admin/settings
├─ components/
│  ├─ ui/                      # Button, Input, Avatar, Modal, ThemeToggle
│  ├─ layout/TopBar, BottomNav
│  ├─ stories/{StoryUploader, StoryViewer, StoryBar, StoryPlayer}
│  ├─ messages/{ChatWindow, ConversationList, MessageComposer}
│  ├─ feed/FeedList
│  ├─ profile/{ProfileEditor, LogoutButton}
│  └─ admin/AdminSettingsForm
├─ hooks/                      # useUser, useUpload, useMediaRecorder, useRealtimeMessages
├─ lib/                        # supabase clients, prisma, auth, utils, constants
├─ services/                   # stories, invites, messages, feed, admin, tags
├─ types/                      # database.ts (supabase-js) + index.ts (prisma re-exports)
├─ prisma/
│  ├─ schema.prisma
│  └─ policies.sql             # RLS, triggers, helpers, storage bucket
├─ styles/globals.css
├─ middleware.ts               # session refresh + route gating
├─ next.config.js, tailwind.config.ts, tsconfig.json
└─ .env.example
```

---

## Getting started

### 1. Create a Supabase project

1. Visit https://app.supabase.com and create a new project.
2. From `Project Settings → API` copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (never expose to the browser)
3. From `Project Settings → Database`, copy the **pooled** connection string (port `6543`) into `DATABASE_URL` and the **direct** one (port `5432`) into `DIRECT_URL`.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Use the environment template that matches where you run BuddyIntro:

**Development** (Windows, macOS, or Linux — coding, testing, creating releases):

```bash
cp .env.development.example .env
# fill in Supabase/database values
npm run startup-check   # creates ./uploads automatically in development
npm run dev
```

**Production** (Ubuntu VPS — runs the live app):

```bash
mkdir -p /home/buddyintro/shared/uploads
cp .env.production.example .env
# fill in production secrets
npm run startup-check
```

See `.env.example` for the full variable reference. Development uses `MEDIA_ROOT=./uploads` (resolved relative to the project). Production requires an absolute path such as `/home/buddyintro/shared/uploads`.

### 4. Push the schema and apply RLS

```bash
npm run db:push     # Prisma schema → Postgres
npm run db:rls      # Apply policies + triggers + storage bucket
```

> If you don't have `psql` locally, paste the contents of `prisma/policies.sql`
> into Supabase's **SQL Editor** instead.

### 5. (Optional) Configure Auth redirects

In Supabase dashboard → `Authentication → URL Configuration` add:

- Site URL: `http://localhost:3000` (and your production URL)
- Redirect URLs: `http://localhost:3000/auth/callback`, `https://your-domain.com/auth/callback`

### 6. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000

---

## How key features work

### Story visibility (`is_co_tagged`)

A SQL `SECURITY DEFINER` function `is_co_tagged(author_id, viewer_id)` returns `true` if `viewer_id` has been tagged in *any* story authored by `author_id`. It's used inside the RLS `select` policy on `stories`, `story_tags` and `posts`.

Result: if A tags B in one story and tags C in another, both B and C have been "co-tagged" by A and can see each other's appearances in A's stories.

### External tagging + auto-publish

When a story is posted with an external email:

1. An `invitation` row is created (and a Supabase magic-link email is sent).
2. A `story_tag` row references that invitation but has no `tagged_user_id`.
3. The story is saved with `status = 'draft'`.
4. When the invitee signs up via the invite link, `acceptInvitation()` flips `registered = true` on the invitation.
5. A Postgres trigger (`on_invitation_registered`) resolves all `story_tags` pointing at that invitation, sets `tagged_user_id`, increments the inviter's `invites_registered`, and tries to publish each affected story.
6. `try_publish_story()` only flips a draft to `published` once it has zero unresolved external tags.

### Realtime messaging

`useRealtimeMessages(userId, otherUserId)` subscribes to `postgres_changes` on `public.messages` and filters to the relevant pair client-side (RLS already restricts `SELECT` to participants).

### Invite gate

`AdminSettings.invite_gate_enabled` + `required_invites` are checked server-side before:
- Sending a message to a tagged user (`/api/messages`)
- Opening the chat page (`app/(main)/messages/[userId]/page.tsx`)

### Mutual-tag feed

`getMutualTagFeed(viewerId)`:
1. Compute users *I* have tagged → `T_v`.
2. Find authors whose stories tagged anyone in `T_v` (excluding me) → mutual authors.
3. Find authors whose stories tagged me → co-tagged authors.
4. Pull `posts` from `(viewer ∪ mutual ∪ co-tagged)` plus visible `stories` and merge by recency.

---

## Production deployment (InterServer / Passenger)

BuddyIntro uses **CloudLinux v6 atomic app-root deployment**. Packages are validated in `staging/` before an atomic sync replaces the live app. Backups are immutable `.tar.gz` archives — never rsync-into-self.

```bash
npm run deploy              # Full: local build → package → staging deploy → atomic sync
npm run deploy:build        # Local build + package only
npm run deploy:upload       # Upload latest standalone package
npm run deploy:verify       # Pre-flight: migrations, build artifacts, git integrity
npm run deploy:backup       # Remote tar.gz backup without deploying
npm run deploy:uploads      # Rsync MEDIA_ROOT uploads to server
npm run deploy:health       # Poll DEPLOY_HEALTH_URL
npm run deploy:release      # Write deployment/manifest.json metadata
npm run deploy:rollback     # Restore a .tar.gz backup archive
npm run deploy:clean        # Remove old server backup archives (keep last 5)
npm run media-worker        # Background image/video optimization queue
npm run media:cleanup       # Delete unreferenced orphan uploads (>24h)
npm run deploy:v3             # Blue/green zero-downtime (PM2 + Ubuntu VPS)
npm run backup:nightly        # Database + uploads + config backup
npm run restore               # Disaster recovery restore utility
```

See **[docs/PRODUCTION_OPERATIONS.md](docs/PRODUCTION_OPERATIONS.md)** for PM2, monitoring, backups, and scaling.
See **[docs/DEPLOYMENT_CLOUDLINUX.md](docs/DEPLOYMENT_CLOUDLINUX.md)** for InterServer CloudLinux setup and **[docs/MEDIA_ARCHITECTURE.md](docs/MEDIA_ARCHITECTURE.md)** for the media platform.

---

## Deploying to Vercel

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add the same env vars as `.env.local`.
4. Set `Build Command` → `npm run build` (already does `prisma generate`).
5. Add your production domain to Supabase Auth redirect URLs.
6. Deploy.

> Vercel will also need `DIRECT_URL` to be reachable. Supabase pooled connections (`pgbouncer=true`) work great in serverless.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | `prisma generate && next build` |
| `npm run start` | Start production server |
| `npm run prisma:studio` | Browse the database |
| `npm run db:push` | Push Prisma schema to Supabase Postgres |
| `npm run db:rls` | Apply `prisma/policies.sql` (RLS + triggers + bucket) |
| `npm run deploy` | Local build + upload standalone release to production |
| `npm run deploy:build` | Build and package locally only |
| `npm run deploy:rollback` | Rollback to previous server release |
| `npm run lint` | ESLint |

---

## Security notes

- **Service-role key** is only imported by `lib/supabase/admin.ts`, which carries `import "server-only"` upstream. Never call admin helpers from a `"use client"` file.
- **RLS is on for every table** including `users`. The policy on `users` lets you read your own row plus anyone in your co-tag graph (so feed/messages can render names).
- **Storage** uses a single public bucket `friendintro` for media. Insert/delete are gated to the owner's user folder (`<userId>/...`).
- All write API routes validate input with **Zod**.

---

## Roadmap / nice to haves

- Push notifications via Web Push or OneSignal.
- Story replies as ephemeral DMs (already wired via `story_reference`, just style differently).
- Reactions per story.
- Edge cron to mark expired stories (`expireStories()` already exists in `services/stories.ts`).
- Image/video transcoding via Supabase Edge Functions.

---

Made with care. Have fun introducing your friends.
