/**
 * Pure helpers for the post-onboarding multi-invite welcome card.
 * Presentation only — does not touch analytics or attribution.
 */

export type WelcomeInviter = {
  invitationId: string;
  name: string;
  activatedAt: Date | null;
  acceptedAt: Date | null;
};

export type WelcomeCardDisplay = {
  totalCount: number;
  activationInviterName: string;
  /** Names shown under "waiting from" (excludes activation inviter). */
  otherInviterNames: string[];
  /** Extra inviters beyond the displayed others (5+ total only). */
  moreCount: number;
  /** Ordered list for compact display: activation first, then others, then +N. */
  listedNames: string[];
};

/**
 * Build display model from associated invitations.
 * Activation inviter MUST come from activatedAt — never inferred.
 * Returns null when there is no activation attribution or fewer than 2 invites.
 */
export function buildWelcomeCardDisplay(
  inviters: WelcomeInviter[]
): WelcomeCardDisplay | null {
  if (inviters.length < 2) return null;

  const withActivation = inviters
    .filter((i) => i.activatedAt != null)
    .sort(
      (a, b) =>
        (a.activatedAt?.getTime() ?? 0) - (b.activatedAt?.getTime() ?? 0)
    );
  const activation = withActivation[0];
  if (!activation) return null;

  const others = inviters
    .filter((i) => i.invitationId !== activation.invitationId)
    .sort(
      (a, b) =>
        (a.acceptedAt?.getTime() ?? 0) - (b.acceptedAt?.getTime() ?? 0)
    );

  const totalCount = inviters.length;
  let otherInviterNames: string[];
  let moreCount = 0;

  if (totalCount <= 4) {
    otherInviterNames = others.map((o) => o.name);
  } else {
    // 5+: activation + 3 additional + "+X more"
    otherInviterNames = others.slice(0, 3).map((o) => o.name);
    moreCount = others.length - 3;
  }

  const listedNames = [activation.name, ...otherInviterNames];

  return {
    totalCount,
    activationInviterName: activation.name,
    otherInviterNames,
    moreCount,
    listedNames,
  };
}
