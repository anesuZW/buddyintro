"use client";

import Link from "next/link";
import { COPY } from "@/lib/copy";
import { TRUST_NETWORK_CARDS } from "@/lib/introduction-routes";
import { Network, Users, GitBranch, ArrowRightLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "introduction-network": Users,
  "mutual-introductions": Network,
  "connected-through-you": ArrowRightLeft,
  "connected-to-you": Users,
  "connection-paths": GitBranch,
};

export function IntroductionNetworkPanel({ userId }: { userId: string }) {
  return (
    <section className="px-4 py-4 border-b border-border">
      <h2 className="text-sm font-semibold mb-3">{COPY.trustNetwork}</h2>
      <div className="grid gap-2">
        {TRUST_NETWORK_CARDS.map((card) => {
          const Icon = ICONS[card.id] ?? Users;
          const href = card.resolveHref(userId);
          return (
            <Link
              key={card.id}
              href={href}
              className="card p-3 flex items-start gap-3 hover:bg-muted/50 transition bg-fi-card border-primary/10"
            >
              <Icon size={18} className="text-primary mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium">{card.title}</div>
                <div className="text-xs text-muted-foreground">{card.description}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
