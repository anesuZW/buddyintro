"use client";

import Image from "next/image";
import { cn, getInitials } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-lg",
};

const sizePx: Record<Size, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

function canOptimizeImage(src: string): boolean {
  if (src.startsWith("data:") || src.startsWith("blob:")) return false;
  if (src.startsWith("/api/")) return false;
  try {
    if (src.startsWith("http://") || src.startsWith("https://")) {
      const host = new URL(src).hostname;
      return (
        host.endsWith(".supabase.co") ||
        host.endsWith(".supabase.in") ||
        host === "images.unsplash.com" ||
        host === "avatars.githubusercontent.com"
      );
    }
  } catch {
    return false;
  }
  // Same-origin paths (/uploads/…) are fine for the default loader.
  return src.startsWith("/");
}

export function Avatar({
  src,
  name,
  size = "md",
  ring = false,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: Size;
  ring?: boolean;
  className?: string;
}) {
  const px = sizePx[size];

  return (
    <div
      className={cn(
        "relative rounded-full overflow-hidden flex items-center justify-center",
        "bg-gradient-to-br from-primary/30 to-accent/30 text-foreground/90 font-semibold",
        sizes[size],
        ring && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
        className
      )}
    >
      {src ? (
        canOptimizeImage(src) ? (
          <Image
            src={src}
            alt={name || "avatar"}
            width={px}
            height={px}
            className="h-full w-full object-cover"
            sizes={`${px}px`}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- signed /api media & blobs
          <img
            src={src}
            alt={name || "avatar"}
            className="h-full w-full object-cover"
          />
        )
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}

export function StoryRingAvatar({
  src,
  name,
  size = "lg",
  active = true,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: Size;
  active?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-full p-[2px]",
        active ? "bg-story-ring" : "bg-border",
        className
      )}
    >
      <div className="bg-background rounded-full p-[2px]">
        <Avatar src={src} name={name} size={size} />
      </div>
    </div>
  );
}
