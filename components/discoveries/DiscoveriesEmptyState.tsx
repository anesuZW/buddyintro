import Link from "next/link";
import { Compass, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function DiscoveriesEmptyState({ expiryHours }: { expiryHours: number }) {
  return (
    <div className="px-4 py-12 text-center max-w-md mx-auto">
      <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Users size={22} className="text-primary" />
      </div>
      <h2 className="text-lg font-semibold">Your trust network is quiet right now</h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Discoveries appear when people in your mutual introduction network share ephemeral updates.
        Posts disappear after {expiryHours} hours — check back often so you do not miss trusted
        moments.
      </p>
      <p className="text-xs text-muted-foreground mt-3">
        Mutual introductions help friends of friends discover you safely — not through public feeds.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
        <Link href="/create-story">
          <Button variant="outline" className="w-full sm:w-auto">
            Make an introduction
          </Button>
        </Link>
        <Link href="/introductions">
          <Button className="w-full sm:w-auto gap-2">
            <Compass size={16} />
            View your network
          </Button>
        </Link>
      </div>
    </div>
  );
}
