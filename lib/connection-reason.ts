import "server-only";

import type { ConnectionReasonPayload, IntroductionEvidencePayload } from "@/types";
import type { ConnectionReason, IntroductionEvidence } from "@/lib/introduction-graph";
import { introductionDetailHref } from "@/lib/introduction-routes";

export function serializeConnectionReason(
  reason: ConnectionReason,
  viewerId: string,
  otherUserId: string
): ConnectionReasonPayload {
  const storyHref = reason.introductionStoryId
    ? introductionDetailHref(reason.introductionStoryId)
    : null;
  const networkHref =
    reason.introductionStoryIds.length > 1
      ? `/introductions/network?users=${viewerId},${otherUserId}`
      : null;

  return {
    reason: reason.reason,
    label: reason.label,
    detail: reason.detail,
    kind: reason.kind,
    mutualCount: reason.mutualCount,
    introducerUser: reason.introducerUser,
    introducerName: reason.introducerName,
    introductionStoryId: reason.introductionStoryId,
    introductionStoryIds: reason.introductionStoryIds,
    introductionDate: reason.introductionDate?.toISOString() ?? null,
    introducers: reason.introducers,
    storyHref,
    networkHref,
    connectionDepth: reason.connectionDepth,
    evidence: reason.evidence.map(serializeEvidence),
  };
}

export function serializeEvidence(e: IntroductionEvidence): IntroductionEvidencePayload {
  return {
    storyId: e.storyId,
    introducer: e.introducer,
    introducedUsers: e.introducedUsers,
    date: e.date.toISOString(),
    caption: e.caption,
    thumbnail: e.thumbnail,
    storyHref: introductionDetailHref(e.storyId),
  };
}
