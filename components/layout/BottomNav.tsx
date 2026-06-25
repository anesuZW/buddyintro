"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, Compass, Handshake, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/discoveries", label: "Discover", icon: Compass },
  { href: "/create-story", label: "Intro", icon: PlusCircle, primary: true },
  { href: "/introductions", label: "Intros", icon: Handshake, badge: true },
  { href: "/profile", label: "Me", icon: User },
];

export function BottomNav({ introBadge = 0 }: { introBadge?: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-border">
      <div className="max-w-2xl mx-auto px-1 h-16 flex items-center justify-between">
        {items.map(({ href, label, icon: Icon, primary, badge }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          if (primary) {
            return (
              <Link key={href} href={href} className="flex-1 flex items-center justify-center">
                <span
                  className={cn(
                    "h-12 w-12 rounded-2xl flex items-center justify-center",
                    "bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition"
                  )}
                  aria-label={label}
                >
                  <Icon size={22} />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] relative",
                "transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-label={label}
            >
              <span className="relative">
                <Icon size={20} />
                {badge && introBadge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {introBadge > 9 ? "9+" : introBadge}
                  </span>
                )}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
