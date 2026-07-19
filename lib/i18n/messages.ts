import { defaultLocale, isAppLocale, type AppLocale } from "@/i18n/routing";

type MessageTree = Record<string, unknown>;

export async function loadMessages(locale: AppLocale): Promise<MessageTree> {
  return (await import(`../../messages/${locale}.json`)).default;
}

export function resolveAppLocale(value?: string | null): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}

export function getMessageValue(messages: MessageTree, key: string): string {
  const parts = key.split(".");
  let current: unknown = messages;
  for (const part of parts) {
    if (!current || typeof current !== "object") return key;
    current = (current as MessageTree)[part];
  }
  return typeof current === "string" ? current : key;
}

export function formatMessage(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, token: string) => String(values[token] ?? `{${token}}`));
}

export async function translateMessage(
  locale: AppLocale,
  key: string,
  values?: Record<string, string | number>
): Promise<string> {
  const messages = await loadMessages(locale);
  const template = getMessageValue(messages, key);
  return formatMessage(template, values);
}
