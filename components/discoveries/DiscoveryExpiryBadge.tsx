import { cn } from "@/lib/utils";
import { formatDiscoveryExpiry, type DiscoveryExpiryDisplay } from "@/lib/discovery-ux";

export function DiscoveryExpiryBadge({
  expiresAt,
  className,
}: {
  expiresAt: Date | string | null | undefined;
  className?: string;
}) {
  const display = formatDiscoveryExpiry(expiresAt);
  if (!display) return null;
  return <ExpiryPill display={display} className={className} />;
}

export function ExpiryPill({
  display,
  className,
}: {
  display: DiscoveryExpiryDisplay;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full",
        display.variant === "expired" && "bg-destructive/15 text-destructive",
        display.variant === "soon" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        display.variant === "active" && "bg-muted text-muted-foreground",
        className
      )}
    >
      {display.label}
    </span>
  );
}
