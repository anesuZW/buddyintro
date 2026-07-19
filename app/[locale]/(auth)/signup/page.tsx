import { cookies } from "next/headers";
import { Suspense } from "react";
import {
  INVITE_EMAIL_COOKIE,
  INVITE_SESSION_COOKIE,
} from "@/lib/invite-session";
import { SignupClient } from "@/components/invite/SignupClient";

export default function SignupPage() {
  const jar = cookies();
  const initialToken = jar.get(INVITE_SESSION_COOKIE)?.value;
  const initialEmail = jar.get(INVITE_EMAIL_COOKIE)?.value;

  return (
    <Suspense
      fallback={
        <div className="card p-8 h-64 animate-pulse bg-muted/30 rounded-2xl" />
      }
    >
      <SignupClient initialToken={initialToken} initialEmail={initialEmail} />
    </Suspense>
  );
}
