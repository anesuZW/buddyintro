import { getMultiInviteWelcomePayload } from "@/services/invites";
import { MultiInviteWelcomeCard } from "@/components/invite/MultiInviteWelcomeCard";

/**
 * Server gate: only runs the invite lookup when the user flag is pending.
 * Mounted from the authenticated main shell after onboarding — never during signup.
 */
export async function MultiInviteWelcomeGate({ userId }: { userId: string }) {
  const payload = await getMultiInviteWelcomePayload(userId);
  if (!payload) return null;
  return <MultiInviteWelcomeCard payload={payload} />;
}
