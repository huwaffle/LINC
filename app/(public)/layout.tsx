import { PublicRail, PublicRailAd } from "@/components/linc/public-rail";
import { Shell } from "@/components/linc/shell";
import { getSession } from "@/lib/auth/session";
import { adminAttention, countSavedEntries, countUnreadNotifications, getAccountById } from "@/lib/db/queries";
import { avatarSrc } from "@/lib/avatars";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const account = session ? await getAccountById(session.id) : undefined;
  const unread =
    session && session.role !== "admin" ? await countUnreadNotifications(session.id) : 0;

  const savedCount = session ? await countSavedEntries(session.id) : 0;
  const deskBadge = session?.role === "admin" ? (await adminAttention()).total : 0;

  return (
    <Shell
      deskBadge={deskBadge}
      savedCount={savedCount}
      asidePinned={<PublicRailAd />}
      aside={<PublicRail userId={session?.id} />}
      user={
        session
          ? {
              displayName: account?.display_name ?? session.displayName,
              role: session.role,
              avatarSrc: avatarSrc(session.id, Boolean(account?.avatar_path)),
            }
          : null
      }
      unread={unread}
    >
      {children}
    </Shell>
  );
}
