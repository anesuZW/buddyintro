import Link from "next/link";
import { COPY } from "@/lib/copy";
import { ConnectionReasonLink } from "@/components/connections/ConnectionReasonLink";
import { IntroductionTimeline } from "@/components/connections/IntroductionTimeline";
import { serializeConnectionReason } from "@/lib/connection-reason";
import { introductionDetailHref } from "@/lib/introduction-routes";
import type { ConnectionReason } from "@/lib/introduction-graph";

type TrustData = Awaited<
  ReturnType<typeof import("@/services/trust-network").getProfileTrustNetwork>
>;

export function TrustNetworkSection({
  data,
  viewerId,
  profileUserId,
}: {
  data: TrustData;
  viewerId: string;
  profileUserId: string;
}) {
  const { stats } = data;
  const isSelf = viewerId === profileUserId;

  const items = [
    { label: COPY.peopleIntroduced, value: stats.peopleYouIntroduced },
    { label: COPY.peopleIntroducedToYou, value: stats.peopleIntroducedToYou },
    { label: COPY.mutualIntroductions, value: data.mutualCount },
    { label: COPY.trustedConnections, value: stats.trustedIntroductions },
  ];

  return (
    <section className="mt-6 space-y-4">
      <h2 className="text-lg font-bold px-1">{COPY.trustNetwork}</h2>

      <div className="grid grid-cols-2 gap-3">
        {items.map((i) => (
          <div key={i.label} className="card p-3 bg-fi-card border-primary/10">
            <div className="text-xl font-bold text-primary">{i.value}</div>
            <div className="text-[11px] text-muted-foreground">{i.label}</div>
          </div>
        ))}
      </div>

      {!isSelf && data.evidence && data.evidence.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">{COPY.howYouAreConnected}</h3>
          <ConnectionReasonLink
            connectionReason={serializeConnectionReason(
              {
                reason: "Trusted connection",
                label: "View how you're connected",
                detail: "",
                kind: "mutual_introducer",
                introducerUser: null,
                introducerName: null,
                introductionStoryId: data.evidence[0]?.storyId ?? null,
                introductionStoryIds: data.evidence.map((e) => e.storyId),
                introductionDate: data.evidence[0]?.date ?? null,
                introducers: [],
                mutualCount: data.mutualCount,
                connectionDepth: null,
                evidence: data.evidence,
              } satisfies ConnectionReason,
              viewerId,
              profileUserId
            )}
          />
          <IntroductionTimeline
            items={data.evidence.map((e) => ({
              ...e,
              date: e.date.toISOString(),
              storyHref: introductionDetailHref(e.storyId),
            }))}
          />
        </div>
      )}

      <Link
        href={`/introductions/network?users=${viewerId},${profileUserId}`}
        className="text-sm text-primary font-medium hover:underline block text-center"
      >
        View introduction network →
      </Link>
    </section>
  );
}
