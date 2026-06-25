"use client";

import Link from "next/link";
import { MessageCircle, Shield } from "lucide-react";
import { BRAND, BRAND_INITIALS } from "@/lib/branding";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function TopBar({
  user,
  isAdmin,
  unreadMessages = 0,
  unreadNotifications = 0,
}: {
  user: { id: string; name: string; profilePicture: string | null };
  isAdmin: boolean;
  unreadMessages?: number;
  unreadNotifications?: number;
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 glass">
      <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/home" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-story-ring p-[2px]">
            <div className="bg-background rounded-[10px] h-full w-full flex items-center justify-center text-xs font-extrabold">
              {BRAND_INITIALS}
            </div>
          </div>
          <span className="font-bold">{BRAND.name}</span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell userId={user.id} initialUnread={unreadNotifications} />
          <Link href="/messages" className="btn-ghost h-10 w-10 p-0 relative" aria-label="Messages">
            <MessageCircle size={18} />
            {unreadMessages > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                {unreadMessages > 9 ? "9+" : unreadMessages}
              </span>
            )}
          </Link>
          {isAdmin && (
            <Link href="/maindash" className="btn-ghost h-10 w-10 p-0">
              <Shield size={18} />
            </Link>
          )}
          <ThemeToggle />
          <Link href="/profile" aria-label="Profile">
            <Avatar
              src={user.profilePicture}
              name={user.name}
              size="md"
              className="border border-border"
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
