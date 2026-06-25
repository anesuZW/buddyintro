"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConnectionReasonLink } from "@/components/connections/ConnectionReasonLink";
import { IntroductionTimeline } from "@/components/connections/IntroductionTimeline";
import type { ConnectionReasonPayload, IntroductionEvidencePayload } from "@/types";

export function IntroductionNetworkView({
  userAId,
  userBId,
}: {
  userAId: string;
  userBId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [connectionReason, setConnectionReason] =
    useState<ConnectionReasonPayload | null>(null);
  const [evidence, setEvidence] = useState<IntroductionEvidencePayload[]>([]);
  const [userNames, setUserNames] = useState<[string, string]>(["You", "Connection"]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/network?users=${encodeURIComponent(`${userAId},${userBId}`)}`
        );
        if (res.ok) {
          const data = await res.json();
          setConnectionReason(data.connectionReason);
          setEvidence(data.evidence ?? []);
          const a = data.users?.find((u: { id: string }) => u.id === userAId);
          const b = data.users?.find((u: { id: string }) => u.id === userBId);
          setUserNames([a?.name ?? "You", b?.name ?? "Connection"]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userAId, userBId]);

  if (loading) {
    return (
      <div className="px-4 py-12 text-center text-muted-foreground animate-pulse">
        Loading introduction network…
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">Introduction network</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stories connecting {userNames[0]} and {userNames[1]}
        </p>
      </div>

      {connectionReason && (
        <ConnectionReasonLink connectionReason={connectionReason} />
      )}

      <IntroductionTimeline items={evidence} />

      <Link href="/discoveries" className="text-sm text-primary hover:underline block">
        ← Back to Discoveries
      </Link>
    </div>
  );
}
