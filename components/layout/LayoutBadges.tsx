import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { isAdminEmail } from "@/lib/utils";
import { getLayoutBadges } from "@/services/layout-badges";
import type { User } from "@prisma/client";

type LayoutUser = Pick<User, "id" | "name" | "profilePicture" | "email" | "lastIntroductionsSeenAt">;

export async function TopBarWithBadges({ user }: { user: LayoutUser }) {
  const { unreadMessages, unreadNotifications } = await getLayoutBadges(user);

  return (
    <TopBar
      user={{
        id: user.id,
        name: user.name,
        profilePicture: user.profilePicture,
      }}
      isAdmin={isAdminEmail(user.email)}
      unreadMessages={unreadMessages}
      unreadNotifications={unreadNotifications}
    />
  );
}

export async function BottomNavWithBadge({ user }: { user: LayoutUser }) {
  const { introBadge } = await getLayoutBadges(user);
  return <BottomNav introBadge={introBadge} />;
}

export function TopBarShell({ user }: { user: LayoutUser }) {
  return (
    <TopBar
      user={{
        id: user.id,
        name: user.name,
        profilePicture: user.profilePicture,
      }}
      isAdmin={isAdminEmail(user.email)}
      unreadMessages={0}
      unreadNotifications={0}
    />
  );
}
