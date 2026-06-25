"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/maindash", label: "Overview" },
  { href: "/maindash/admin-users", label: "Admin users" },
  { href: "/maindash/audit", label: "Audit log" },
  { href: "/maindash/jobs", label: "Jobs" },
  { href: "/maindash/security", label: "Security" },
  { href: "/maindash/trust-risk", label: "Trust risk" },
  { href: "/maindash/system-health", label: "System health" },
  { href: "/maindash/performance", label: "Performance" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 mb-6">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm border",
            pathname === l.href
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:bg-muted"
          )}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
