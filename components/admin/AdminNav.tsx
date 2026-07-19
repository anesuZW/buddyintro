"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";
import { cn } from "@/lib/utils";

export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations("admin");

  const links = [
    { href: "/maindash", label: t("overview") },
    { href: "/maindash/admin-users", label: t("adminUsers") },
    { href: "/maindash/audit", label: t("auditLog") },
    { href: "/maindash/jobs", label: t("jobs") },
    { href: "/maindash/storage", label: t("storage") },
    { href: "/maindash/security", label: t("security") },
    { href: "/maindash/trust-risk", label: t("trustRisk") },
    { href: "/maindash/system-health", label: t("systemHealth") },
    { href: "/maindash/system", label: t("system") },
    { href: "/maindash/performance", label: t("performance") },
  ] as const;

  return (
    <div className="space-y-4 mb-6">
      <div className="flex justify-end">
        <LanguageSelector compact className="max-w-[220px]" />
      </div>
      <nav className="flex flex-wrap gap-2">
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
    </div>
  );
}
