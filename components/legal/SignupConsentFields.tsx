"use client";

import Link from "next/link";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

export function SignupConsentFields({
  acceptedTerms,
  setAcceptedTerms,
}: {
  acceptedTerms: boolean;
  setAcceptedTerms: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        required
        checked={acceptedTerms}
        onChange={(e) => setAcceptedTerms(e.target.checked)}
        className="mt-1 h-4 w-4"
      />
      <span className="text-muted-foreground">
        I am at least 13 years old and agree to the{" "}
        <Link href="/terms" className="text-primary underline" target="_blank">
          Terms of Service
        </Link>{" "}
        (v{LEGAL_VERSIONS.terms}) and{" "}
        <Link href="/privacy" className="text-primary underline" target="_blank">
          Privacy Policy
        </Link>{" "}
        (v{LEGAL_VERSIONS.privacy}).
      </span>
    </label>
  );
}
