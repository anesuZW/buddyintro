import Link from "next/link";
import { introductionDetailHref } from "@/lib/introduction-routes";
import { COPY } from "@/lib/copy";
type Stats = Awaited<
  ReturnType<typeof import("@/services/trust-network").getTrustNetworkStats>
>;

export function TrustNetworkDashboard({ stats }: { stats: Stats }) {
  const cards = [
    { label: COPY.peopleYouIntroduced, value: stats.peopleYouIntroduced },
    { label: COPY.peopleIntroducedToYou, value: stats.peopleIntroducedToYou },
    { label: COPY.mutualConnections, value: stats.mutualConnections },
    { label: COPY.trustedIntroductions, value: stats.trustedIntroductions },
  ];

  return (
    <section className="px-4 pt-4 pb-2">
      <div className="rounded-2xl border border-primary/15 bg-fi-card p-4 mb-4">
        <h2 className="text-lg font-bold">{COPY.buildTrustedNetwork}</h2>
        <p className="text-sm text-muted-foreground mt-2">{COPY.buildTrustedNetworkBody}</p>
        <p className="text-xs text-primary/80 mt-2 font-medium">{COPY.notSocialMedia}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-3 bg-fi-card border-primary/10">
            <div className="text-2xl font-bold text-primary">{c.value}</div>
            <div className="text-[11px] text-muted-foreground leading-tight mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {(stats.recentSent.length > 0 || stats.recentReceived.length > 0) && (
        <div>
          <h3 className="text-sm font-semibold mb-2 px-1">{COPY.recentIntroductions}</h3>
          <div className="space-y-2">
            {[...stats.recentReceived, ...stats.recentSent].slice(0, 4).map((s) => (
              <Link
                key={s.id}
                href={introductionDetailHref(s.id)}
                className="card p-3 flex items-center gap-3 hover:bg-muted/50 transition text-sm"
              >
                <div className="h-10 w-8 rounded bg-muted overflow-hidden shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.mediaUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.user.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.text ?? "Trusted introduction"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
