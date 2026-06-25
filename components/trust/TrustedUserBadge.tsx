import { verificationLevelLabel } from "@/lib/verification-level";
import type { VerificationLevel } from "@prisma/client";
import { Shield, BadgeCheck } from "lucide-react";

export function TrustedUserBadge({
  trustedUser,
  verificationLevel,
  compact = false,
}: {
  trustedUser?: boolean;
  verificationLevel?: VerificationLevel;
  compact?: boolean;
}) {
  if (!trustedUser && (!verificationLevel || verificationLevel === "none")) return null;

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {trustedUser && (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary font-medium ${
            compact ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
          }`}
        >
          <Shield size={compact ? 10 : 12} />
          Trusted member
        </span>
      )}
      {verificationLevel && verificationLevel !== "none" && !trustedUser && (
        <span
          className={`inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground ${
            compact ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"
          }`}
        >
          <BadgeCheck size={compact ? 10 : 12} />
          {verificationLevelLabel(verificationLevel)}
        </span>
      )}
    </span>
  );
}
