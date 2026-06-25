/** Normalize and validate international phone numbers (E.164). */

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) {
    if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
    else return null;
  }

  if (!E164_REGEX.test(digits)) return null;
  return digits;
}

export function isPhoneNumber(input: string): boolean {
  return normalizePhone(input) !== null;
}

export function phoneDigitsE164(phone: string): string {
  return phone.replace(/\D/g, "");
}
