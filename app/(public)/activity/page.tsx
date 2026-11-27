import type { Metadata } from "next";
import { ActivityPanel } from "@/components/linc/activity-feed";
import { AutoRefresh } from "@/components/linc/auto-refresh";
import { Notice } from "@/components/linc/empty-state";
import { PageHeader } from "@/components/linc/page-header";
import { buildActivityFeed, parseActivityFilter } from "@/lib/activity";
import { requireUser } from "@/lib/auth/session";
import {
  countUnreadNotifications,
  listActivity,
  listNotifications,
  listOutgoingActivity,
} from "@/lib/db/queries";
import { messageFrom } from "@/lib/redirects";

export const metadata: Metadata = { title: "Activity · LINC" };

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string; filter?: string }>;
}) {
  const session = await requireUser("/activity");
  const sp = await searchParams;
  const incoming = await listActivity(session.id);
  const outgoing = await listOutgoingActivity(session.id);
  const notifications = await listNotifications(session.id);
  const items = buildActivityFeed({ incoming, outgoing, notifications });
  const unread = await countUnreadNotifications(session.id);
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });

  return (
    <div>
      <AutoRefresh seconds={25} />
      <PageHeader
        title="Activity"
        subtitle={unread > 0 ? `${unread} unread` : undefined}
      />

      {message.text && (
        <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
      )}

      <ActivityPanel items={items} unread={unread} filter={parseActivityFilter(sp.filter)} />
    </div>
  );
}
