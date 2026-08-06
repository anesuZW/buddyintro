import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict } from "date-fns";
import { BRAND } from "@/lib/branding";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getInitials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function appUrl(path = "") {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const fromWindow =
    typeof window !== "undefined" ? window.location.origin : undefined;
  // Prefer env → browser origin → localhost (dev). Production should always
  // set NEXT_PUBLIC_APP_URL; brand domain is the last-resort SSR fallback.
  const base =
    fromEnv ||
    fromWindow ||
    (process.env.NODE_ENV !== "production"
      ? "http://localhost:3000"
      : `https://${BRAND.domain}`);
  return `${base.replace(/\/$/, "")}${path}`;
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
