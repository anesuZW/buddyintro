# Sharing Improvements

## Preserved viral loop

Phone number entered during introduction creation remains the source of truth.

Flow:

1. Enter recipient phone (step 0)  
2. Pick relationship + media  
3. Publish → **background upload**  
4. Ready-to-Share uses the same E.164 number in WhatsApp / SMS / iMessage deep links  

No second phone entry. Numbers survive navigation via Upload Manager + IDB draft.

## Personalized message

`lib/invite-share.ts` now builds:

```
{Name} has introduced you to {Name}'s community as a {Relationship}.

See what they shared about you on BuddyIntro.

{previewLink}
```

Links point at `/invite-preview/{token}` so Open Graph crawlers see story metadata.

## Ready-to-Share

Full-screen experience after upload completes:

- Media preview  
- Relationship label  
- Recipient phone  
- WhatsApp / SMS·iMessage / Copy  
- Completion check animation  

## Share into BuddyIntro (PWA)

`POST /api/share/target` now uploads media when the user is authenticated and stores `{ mediaUrl, mediaType }` in the draft cookie.

- Media shares → `/create-story?shared=1` (bootstrap banner + session stash)  
- Text / failed upload → `/share?draft=1` Discoveries review with optional media preview  
