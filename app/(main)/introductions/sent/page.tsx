import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSentIntroductionsForUser } from "@/services/introductions";
import { IntroductionCard } from "@/components/introductions/IntroductionCard";
import { INTRODUCTIONS_ROUTES } from "@/lib/introduction-routes";

export default async function SentIntroductionsPage() {
  const me = await requireUser();
  const items = await getSentIntroductionsForUser(me.id);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto">
      <Link href={INTRODUCTIONS_ROUTES.hub} className="text-sm text-primary hover:underline">
        ← Back to introductions
      </Link>
      <h1 className="text-xl font-bold mt-3">People connected through you</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Introductions you created for people in your trusted network.
      </p>
      <div className="space-y-4 mt-6">
        {items.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            You have not published any introductions yet.
          </p>
        ) : (
          items.map((item) => (
            <IntroductionCard key={item.id} item={item} perspective="sent" />
          ))
        )}
      </div>
    </div>
  );
}
