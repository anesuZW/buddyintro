"use client";

import { buildDiscoveryTrustContext } from "@/lib/discovery-ux";
import type { ConnectionReasonPayload, TrustProfilePayload } from "@/types";

export function DiscoveryTrustContext({
  connectionReason,
  trustProfile,
}: {
  connectionReason?: ConnectionReasonPayload | null;
  trustProfile?: TrustProfilePayload | null;
}) {
  const line = buildDiscoveryTrustContext({ connectionReason, trustProfile });
  if (!line) return null;

  return (
    <p className="text-[11px] text-primary/90 mt-1.5 leading-snug font-medium">{line}</p>
  );
}
