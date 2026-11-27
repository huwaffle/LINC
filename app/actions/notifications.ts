"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { sqlite } from "@/lib/db/client";
import { done, fail } from "@/lib/redirects";

async function requireSession() {
  return await getSession();
}

export async function markNotificationRead(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session) fail("/login", "Please sign in to read your notifications.");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) fail("/activity", "That notification could not be found.");

  await sqlite
    .prepare("update outbox set read_at = ? where id = ? and to_user_id = ? and read_at is null")
    .run(Date.now(), id, session.id);

  revalidatePath("/", "layout");
  revalidatePath("/activity");
  revalidatePath("/me");
  done("/activity", "Notification marked as read.");
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await requireSession();
  if (!session) fail("/login", "Please sign in to read your notifications.");

  const result = await sqlite
    .prepare("update outbox set read_at = ? where to_user_id = ? and read_at is null")
    .run(Date.now(), session.id);

  revalidatePath("/", "layout");
  revalidatePath("/activity");
  revalidatePath("/me");
  done(
    "/activity",
    result.changes > 0
      ? "All notifications marked as read."
      : "You have no unread notifications.",
  );
}
