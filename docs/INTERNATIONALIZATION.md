# Internationalization (i18n)

BuddyIntro uses [next-intl](https://next-intl.dev) with the Next.js 14 App Router.

## Architecture

```
i18n/
  routing.ts          # locales, default locale, RTL list, cookie name
  request.ts          # server message loading + locale resolution

messages/
  en.json             # master catalog
  es.json … ko.json   # locale catalogs (merged from en + overrides)

lib/i18n/
  resolve-locale.ts   # priority: profile > cookie > URL > browser > en
  navigation.ts       # locale-aware Link / router helpers
  messages.ts         # server-side bundle loading + formatting
  notifications.ts    # localized notification copy for emitters/emails
  session-locale.ts   # reads preferredLanguage for authenticated users

components/
  providers/LanguageProvider.tsx
  i18n/LanguageSelector.tsx
  i18n/TranslateAction.tsx   # UGC placeholder (no AI yet)

app/
  [locale]/                 # all localized pages
  api/user/language/route.ts
```

### Locale resolution priority

1. `users.preferred_language` (authenticated profile)
2. `NEXT_LOCALE` cookie (explicit user choice)
3. URL locale segment (`/es/...`, omitted for English with `as-needed`)
4. Browser `Accept-Language`
5. English (`en`)

An explicit cookie or profile preference is never overridden by browser detection.

### Performance

- Message bundles are dynamically imported in `i18n/request.ts` (`import('../messages/${locale}.json')`).
- Only the active locale is loaded per request.
- Other locales are tree-shaken from the client bundle.

### RTL

Arabic (`ar`) sets `dir="rtl"` on `<html>`. Navigation uses logical CSS (`inset-x`, `end`) where updated.

## Adding a language

1. Add the locale code to `i18n/routing.ts` (`locales`, `localeLabels`, optional `rtlLocales`).
2. Add overrides to `scripts/generate-locale-messages.js` or create `messages/<locale>.json`.
3. Run `node scripts/generate-locale-messages.js`.
4. Add the language name (in its own language) to `localeLabels`.
5. Deploy with `prisma migrate deploy` if schema changes are required.

## Translation workflow

1. Add keys to `messages/en.json` first.
2. Mirror keys in other locale files (generator merges patches onto English).
3. Use `useTranslations('namespace')` in client components.
4. Use `getTranslations('namespace')` in server components/actions.
5. Use `translateMessage()` / `lib/i18n/notifications.ts` for server-only contexts (notifications, email).

### Validation messages

Use keys under `validation.*` in message files. Map Zod/API errors to translation keys instead of hardcoded English strings.

## User-generated content

Stories, introductions, comments, chats, captions, and transcriptions are **never auto-translated**.

Use the `TranslateAction` component as a UI hook for future AI translation:

```tsx
import { TranslateAction } from "@/components/i18n/TranslateAction";

<TranslateAction contentType="comment" />
```

## Future AI translation integration

1. Implement a service behind `TranslateAction` (`onClick` handler).
2. Store optional `originalLanguage` metadata separately from translated display text.
3. Keep author content immutable; show translations as derived overlays.
4. Reuse `lib/i18n/messages.ts` formatters for UI chrome around translated content.

## API

`PATCH /api/user/language`

```json
{ "preferredLanguage": "es" }
```

Updates the database, sets the `NEXT_LOCALE` cookie, and refreshes the UI via `LanguageProvider`.

## Testing

```bash
npm test -- tests/i18n.test.ts
```

Covers locale detection, bundle loading, RTL, notification copy, and missing-key fallback behavior.
