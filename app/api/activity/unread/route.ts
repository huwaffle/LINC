import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { countUnreadNotifications } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** Polled by the shell so the Activity badge updates without a reload. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ unread: 0 });
  return NextResponse.json({ unread: await countUnreadNotifications(session.id) });
}
