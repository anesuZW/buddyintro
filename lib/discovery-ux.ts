import type { ConnectionReasonPayload, TrustProfilePayload } from "@/types";

export type DiscoveryExpiryDisplay = {
  label: string;
  variant: "active" | "soon" | "expired";
};

function isTomorrow(expires: Date, now: Date): boolean {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    expires.getFullYear() === tomorrow.getFullYear() &&
    expires.getMonth() === tomorrow.getMonth() &&
    expires.getDate() === tomorrow.getDate()
  );
}

/** Human-readable expiry label for discovery cards. */
export function formatDiscoveryExpiry(
  expiresAt: Date | string | null | undefined,
  now = new Date()
): DiscoveryExpiryDisplay | null {
  if (!expiresAt) return null;

  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return null;

  if (exp.getTime() <= now.getTime()) {
    return { label: "Expired", variant: "expired" };
  }

  const ms = exp.getTime() - now.getTime();
  const hours = ms / (1000 * 60 * 60);

  if (isTomorrow(exp, now)) {
    return { label: "Expires tomorrow", variant: "soon" };
  }

  if (hours < 1) {
    const minutes = Math.max(1, Math.ceil(ms / (1000 * 60)));
    return { label: `Expires in ${minutes} min`, variant: "soon" };
  }

  const roundedHours = Math.ceil(hours);
  return {
    label: `Expires in ${roundedHours} hour${roundedHours === 1 ? "" : "s"}`,
    variant: roundedHours <= 6 ? "soon" : "active",
  };
}

export function displayDiscoveryExpiryHours(hours: number | null | undefined): number {
  return hours && hours > 0 ? hours : 24;
}

export function buildDiscoveryTrustContext(args: {
  connectionReason?: ConnectionReasonPayload | null;
  trustProfile?: TrustProfilePayload | null;
}): string | null {
  const depth = args.connectionReason?.connectionDepth ?? args.trustProfile?.connectionDegree;
  const shared =
    args.trustProfile?.sharedIntroducerCount ??
    args.connectionReason?.mutualCount ??
    0;

  if (typeof depth === "number" && depth >= 2) {
    return `Visible through ${depth} mutual introductions`;
  }

  if (shared >= 2) {
    return `Visible through ${shared} mutual introductions`;
  }

  const introducers = args.connectionReason?.introducers ?? [];
  if (introducers.length >= 2) {
    const first = introducers[0].name.split(/\s+/)[0];
    const second = introducers[1].name.split(/\s+/)[0];
    return `Trusted path: ${first} → ${second} → You`;
  }

  if (introducers.length === 1) {
    const first = introducers[0].name.split(/\s+/)[0];
    return `Trusted path: ${first} → You`;
  }

  if (args.connectionReason?.introducerName) {
    const first = args.connectionReason.introducerName.split(/\s+/)[0];
    return `Trusted path: ${first} → You`;
  }

  if (depth === 1) {
    return "Visible through your trusted introduction network";
  }

  if (shared === 1) {
    return "Visible through 1 mutual introduction";
  }

  return null;
}
