import { Check } from "lucide-react";
import { COPY } from "@/lib/copy";

export function VerificationBadges({
  verification,
}: {
  verification: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
  };
}) {
  const items = [
    { ok: verification.emailVerified, label: COPY.verifiedEmail },
    { ok: verification.phoneVerified, label: COPY.verifiedPhone },
    { ok: verification.identityVerified, label: COPY.verifiedIdentity },
  ].filter((i) => i.ok);

  if (!items.length) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item.label}
          className="inline-flex items-center gap-1 text-xs text-accent bg-accent/10 px-2 py-1 rounded-full"
        >
          <Check size={12} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
