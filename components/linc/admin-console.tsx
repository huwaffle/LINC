import Link from "next/link";
import { BackButton } from "@/components/linc/back-button";
import { Shell } from "@/components/linc/shell";
import type { SessionUser } from "@/lib/auth/session";
import { adminAttention, adminStats, countSavedEntries, getAccountById } from "@/lib/db/queries";
import { avatarSrc } from "@/lib/avatars";

/** The admin console frame (header, tabs, rail badges); also wraps the moderation desk for admins. */
export async function AdminConsole({ session, children }: { session: SessionUser; children: React.ReactNode }) {
  const stats = await adminStats();
  const account = await getAccountById(session.id);

  const attention = await adminAttention();

  const links: Array<{ href: string; label: string; badge?: number }> = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/insights", label: "Insights" },
    { href: "/admin/posts", label: "Moderation", badge: attention.pending },
    { href: "/admin/events/new", label: "New event" },
    { href: "/admin/ads", label: "Ads" },
    { href: "/admin/algorithms", label: "Algorithms" },
    { href: "/admin/safety", label: "Safety", badge: attention.safety },
    { href: "/admin/outbox", label: "Outbox", badge: attention.outbox },
    { href: "/admin/users", label: "Users" },
  ];

  return (
    <Shell
      wide
      deskBadge={attention.total}
      savedCount={await countSavedEntries(session.id)}
      user={{
        displayName: account?.display_name ?? session.displayName,
        role: session.role,
        avatarSrc: avatarSrc(session.id, Boolean(account?.avatar_path)),
      }}
    >
      <div className="border-b border-line bg-white">
        <div className="flex items-center gap-2 px-3 pt-3">
          <BackButton fallbackHref="/admin" />
          <div className="min-w-0">
            <p className="text-[15px] font-bold tracking-[-0.01em] text-ink">System console</p>
            <p className="truncate text-[12px] text-neutral-500">
              Administrator
              {stats.outbox > 0 ? ` · ${stats.outbox} unread` : ""}
            </p>
          </div>
        </div>
        <nav className="no-scrollbar mt-2 flex items-center gap-1 overflow-x-auto px-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-label={link.badge ? `${link.label}, ${link.badge} waiting` : undefined}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-ink"
            >
              {link.label}
              {link.badge ? (
                <span className="min-w-[18px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                  {link.badge > 99 ? "99+" : link.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </Shell>
  );
}
