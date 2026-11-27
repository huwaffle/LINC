"use client";

import Link from "next/link";
import { AutoScrollAside } from "./auto-scroll-aside";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  BookmarkIcon,
  CalendarIcon,
  HomeIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  UsersIcon,
} from "./icons";
import { Avatar } from "./avatar";
import { ActivityCountBadge } from "./activity-count";
import { ThemeToggle } from "./theme-toggle";

type ShellUser = {
  displayName: string;
  role: "admin" | "student";
  avatarSrc?: string;
} | null;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function RailLink({
  href,
  label,
  active,
  badge = 0,
  badgeContent,
  badgeClass = "bg-rose-600",
  badgeLabel = "unread",
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
  /** Live-rendered badge; falls back to the numeric badge when omitted. */
  badgeContent?: React.ReactNode;
  badgeClass?: string;
  /** Word read after the count in the link's accessible name. */
  badgeLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={badge > 0 ? `${label}, ${badge} ${badgeLabel}` : label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`relative flex h-11 items-center justify-center gap-3 rounded-xl px-2.5 text-[15px] font-medium transition lg:justify-start ${
        active
          ? "bg-neutral-100 text-ink"
          : "text-neutral-500 hover:bg-neutral-100 hover:text-ink"
      }`}
    >
      <span className="shrink-0 transition active:scale-90">{children}</span>
      <span className="hidden truncate lg:inline">{label}</span>
      {badgeContent ??
        (badge > 0 && (
          <span className={`absolute right-0.5 top-0.5 min-w-[17px] rounded-full ${badgeClass} px-1 text-center text-[10px] font-bold leading-[17px] text-white lg:static lg:ml-auto lg:min-w-[20px] lg:leading-5`}>
            {badge > 9 ? "9+" : badge}
          </span>
        ))}
    </Link>
  );
}

/** Bottom-bar tab with a clear active state (tint, dot, aria-current). */
function BottomLink({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`relative grid h-11 w-12 place-items-center rounded-xl transition active:scale-90 ${
        active ? "bg-neutral-100 text-ink" : "text-neutral-500 hover:text-ink"
      }`}
    >
      {children}
      {active && (
        <span aria-hidden className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-linc-600" />
      )}
    </Link>
  );
}

export function Shell({
  children,
  user,
  aside,
  asidePinned,
  wide = false,
  unread = 0,
  deskBadge = 0,
  savedCount = 0,
}: {
  children: React.ReactNode;
  user: ShellUser;
  aside?: React.ReactNode;
  /** Stays fixed at the top of the right column while `aside` scrolls beneath it. */
  asidePinned?: React.ReactNode;
  wide?: boolean;
  unread?: number;
  /** Items waiting on the admin; shown on the admin console link. */
  deskBadge?: number;
  /** Number of posts the viewer has saved; shown on the Saved link. */
  savedCount?: number;
}) {
  const pathname = usePathname();

  const primary = [
    { href: "/", label: "Home", icon: <HomeIcon className="h-[26px] w-[26px]" /> },
    { href: "/search", label: "Search", icon: <SearchIcon className="h-[26px] w-[26px]" /> },
    { href: "/events", label: "Events", icon: <CalendarIcon className="h-[26px] w-[26px]" /> },
  ];

  const composeItem = {
    href: "/submit",
    label: "New post",
    icon: <PlusIcon className="h-[26px] w-[26px]" />,
  };

  const desk =
    user?.role === "admin"
      ? {
          href: "/admin",
          label: "Admin console",
          icon: <ShieldIcon className="h-[26px] w-[26px]" />,
        }
      : null;

  const profileHref = user ? "/me" : "/login";
  const railWidth = aside ? "md:w-[76px] lg:w-[236px]" : "md:w-[76px] lg:w-[220px]";
  const mainWidth = wide
    ? "md:max-w-[720px] lg:max-w-[900px] xl:w-[900px]"
    : "md:max-w-[620px] lg:max-w-[640px] xl:w-[640px]";

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only z-[200] rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b border-line bg-white/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <Link href="/" aria-label="LINC home" className="text-[22px] font-black tracking-[-0.04em] text-linc-600">
          LINC
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href={user ? "/me" : "/login"}
            aria-label={user ? "My activity" : "Sign in"}
            className="text-[12px] font-semibold text-neutral-500"
          >
            {user ? <Avatar name={user.displayName} src={user.avatarSrc} size={28} /> : "Sign in"}
          </Link>
        </div>
      </header>

      {/*
        Full width, so the rail always owns the real left edge of the window.
        The feed group stays centered in the remaining space.
      */}
      <div data-linc-shell className="flex w-full xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {/* Navigation rail: anchored to the far left on tablet/desktop */}
        <nav
          className={`order-1 xl:col-start-1 xl:row-start-1 sticky top-0 hidden h-screen shrink-0 flex-col justify-between py-4 md:flex ${railWidth} lg:px-3`}
        >
          <div className="flex flex-col gap-0.5 md:items-center lg:items-stretch">
            <Link
              href="/"
              aria-label="LINC home"
              className="mb-4 flex items-center md:justify-center lg:justify-start lg:px-2"
            >
              <span className="text-[17px] font-black tracking-[-0.04em] text-linc-600 transition hover:text-linc-700 lg:text-[26px]">
                LINC
              </span>
            </Link>

            {primary.map((item) => (
              <RailLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActive(pathname, item.href)}
              >
                {item.icon}
              </RailLink>
            ))}

            <Link
              href={composeItem.href}
              aria-label={composeItem.label}
              title={composeItem.label}
              className="mt-1 flex h-11 items-center justify-center gap-3 rounded-xl bg-linc-600 px-2.5 text-[15px] font-semibold text-white transition hover:bg-linc-700 lg:justify-start"
            >
              <span className="shrink-0">{composeItem.icon}</span>
              <span className="hidden truncate lg:inline">{composeItem.label}</span>
            </Link>

            {desk && (
              <RailLink
                href={desk.href}
                label={desk.label}
                active={isActive(pathname, desk.href)}
                badge={deskBadge}
                badgeLabel="waiting"
              >
                {desk.icon}
              </RailLink>
            )}

            {user && (
              <RailLink
                href="/saved"
                label="Saved"
                active={isActive(pathname, "/saved")}
                badge={savedCount}
                badgeClass="bg-linc-600"
                badgeLabel="saved"
              >
                <BookmarkIcon className="h-[26px] w-[26px]" />
              </RailLink>
            )}

            {user && user.role !== "admin" && (
              <RailLink
                href="/activity"
                label="Activity"
                active={isActive(pathname, "/activity")}
                badge={unread}
                badgeContent={
                  <ActivityCountBadge
                    initial={unread}
                    className="absolute right-0.5 top-0.5 min-w-[17px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-[17px] text-white lg:static lg:ml-auto lg:min-w-[20px] lg:leading-5"
                  />
                }
              >
                <ActivityIcon className="h-[26px] w-[26px]" />
              </RailLink>
            )}

            {user?.role === "admin" && (
              <RailLink
                href="/admin/users"
                label="People"
                active={isActive(pathname, "/admin/users")}
              >
                <UsersIcon className="h-[26px] w-[26px]" />
              </RailLink>
            )}
          </div>

          <div className="flex flex-col gap-2 md:items-center lg:items-stretch">
            <ThemeToggle showLabel className="w-full" />
            {user ? (
              <>
                <Link
                  href={profileHref}
                  aria-label="My activity"
                  title="My activity"
                  className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-neutral-100 lg:justify-start"
                >
                  <Avatar
                    name={user.displayName}
                    src={user.avatarSrc}
                    size={36}
                    className="shrink-0 ring-1 ring-line"
                  />
                  <span className="hidden min-w-0 lg:block">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {user.displayName}
                    </span>
                    <span className="block text-[11px] capitalize text-neutral-500">
                      {user.role}
                    </span>
                  </span>
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="w-full rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-ink lg:text-left"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-linc-600 px-3 py-2 text-center text-[13px] font-semibold text-white transition hover:bg-linc-700"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>

        {/*
          The rail owns the left edge. Everything else lives in a centered
          group, so the feed stays centered whether or not a support panel
          is rendered (admin has no support panel).
        */}
        <div className="order-2 flex min-w-0 flex-1 justify-center xl:contents">
          {/* Center column */}
          <main
            id="main-content"
            tabIndex={-1}
            className={`min-h-screen min-w-0 flex-1 border-line xl:col-start-2 xl:row-start-1 bg-white pb-[calc(4rem+env(safe-area-inset-bottom))] outline-none md:border-x md:pb-0 ${mainWidth}`}
          >
            {children}
          </main>

          {/* Supporting panels sit on the right; navigation owns the left edge. */}
          {aside && (
            <AutoScrollAside pinned={asidePinned}>{aside}</AutoScrollAside>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] items-start justify-around border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur md:hidden"
      >
        {primary.map((item) => (
          <BottomLink key={item.href} href={item.href} label={item.label} active={isActive(pathname, item.href)}>
            {item.icon}
          </BottomLink>
        ))}
        {user && user.role !== "admin" && (
          <BottomLink
            href="/activity"
            label={unread > 0 ? `Activity, ${unread} unread` : "Activity"}
            active={isActive(pathname, "/activity")}
          >
            <ActivityIcon className="h-[24px] w-[24px]" />
            <ActivityCountBadge
              initial={unread}
              className="absolute right-1 top-1 min-w-[16px] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-4 text-white"
            />
          </BottomLink>
        )}
        {user && (
          <BottomLink
            href="/saved"
            label={savedCount > 0 ? `Saved, ${savedCount} saved` : "Saved"}
            active={isActive(pathname, "/saved")}
          >
            <BookmarkIcon className="h-[24px] w-[24px]" />
            {savedCount > 0 && (
              <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-linc-600 px-1 text-center text-[10px] font-bold leading-4 text-white">
                {savedCount > 9 ? "9+" : savedCount}
              </span>
            )}
          </BottomLink>
        )}
        <BottomLink
          href={profileHref}
          label={user ? "My activity" : "Sign in"}
          active={isActive(pathname, profileHref)}
        >
          {user ? (
            <Avatar name={user.displayName} src={user.avatarSrc} size={26} />
          ) : (
            <UsersIcon className="h-[24px] w-[24px]" />
          )}
        </BottomLink>
      </nav>
    </div>
  );
}
