import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getMutualIntroductionPartners } from "@/services/introductions";
import { Avatar } from "@/components/ui/Avatar";
import { INTRODUCTIONS_ROUTES } from "@/lib/introduction-routes";

export default async function MutualIntroductionsPage() {
  const me = await requireUser();
  const partners = await getMutualIntroductionPartners(me.id);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Link href={INTRODUCTIONS_ROUTES.hub} className="text-sm text-primary hover:underline">
        ← Back to introductions
      </Link>
      <h1 className="text-xl font-bold mt-3">Mutual introductions</h1>
      <p className="text-sm text-muted-foreground mt-1">
        People connected to you through shared trusted introducers.
      </p>
      <div className="space-y-3 mt-6">
        {partners.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No mutual introduction paths yet. As your network grows, shared introducers will appear here.
          </p>
        ) : (
          partners.map((p) => (
            <Link
              key={p.userId}
              href={p.networkHref}
              className="card p-4 flex items-center gap-3 hover:bg-muted/50 transition"
            >
              <Avatar src={p.profilePicture} name={p.name} size="md" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.sharedIntroducerCount} shared trusted introducer
                  {p.sharedIntroducerCount === 1 ? "" : "s"}
                </div>
              </div>
              <span className="text-xs text-primary shrink-0">View path →</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
