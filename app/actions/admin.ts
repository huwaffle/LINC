"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { sqlite } from "@/lib/db/client";
import { done, fail } from "@/lib/redirects";

export async function markOutboxRead(): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") fail("/login", "Administrator access required.");

  await sqlite
    .prepare("update outbox set read_at = ? where read_at is null and to_user_id is null")
    .run(Date.now());
  revalidatePath("/admin/outbox");
  revalidatePath("/admin");
  done("/admin/outbox", "Inbox marked as read.");
}
