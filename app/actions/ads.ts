"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { sqlite } from "@/lib/db/client";
import { getAd, isSafeAdUrl } from "@/lib/db/ads";
import { newId } from "@/lib/db/users";
import { done, fail } from "@/lib/redirects";
import { removeFileQuietly, uploadFile } from "@/lib/storage";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function requireAdmin(): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") fail("/login", "Administrator access required.");
}

/** Date inputs are interpreted in Manila time, like the rest of the UI. */
function dayBoundary(value: FormDataEntryValue | null, edge: "start" | "end"): number | null {
  const text = typeof value === "string" ? value : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const time = edge === "start" ? "T00:00:00+08:00" : "T23:59:59.999+08:00";
  const ms = new Date(`${text}${time}`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function refresh(): void {
  revalidatePath("/", "layout");
  revalidatePath("/admin/ads");
}

export async function createAd(formData: FormData): Promise<void> {
  await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const sponsor = String(formData.get("sponsor") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const link = String(formData.get("link") ?? "").trim();

  if (!title || title.length > 80) fail("/admin/ads", "Add a headline of 80 characters or fewer.");
  if (!sponsor || sponsor.length > 60) fail("/admin/ads", "Add a sponsor name of 60 characters or fewer.");
  if (body.length > 240) fail("/admin/ads", "The description must be 240 characters or fewer.");
  if (!isSafeAdUrl(link)) fail("/admin/ads", "Enter a full link starting with http:// or https://.");

  const startsAt = dayBoundary(formData.get("startsAt"), "start");
  const endsAt = dayBoundary(formData.get("endsAt"), "end");
  if (startsAt !== null && endsAt !== null && endsAt < startsAt) {
    fail("/admin/ads", "The end date must be on or after the start date.");
  }

  let imagePath: string | null = null;
  let imageMime: string | null = null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) fail("/admin/ads", "Images must be 5 MB or smaller.");
    if (!EXTENSION_BY_MIME[file.type]) fail("/admin/ads", "Images must be PNG, JPEG, WebP, or GIF.");
    imagePath = `${newId("ad")}.${EXTENSION_BY_MIME[file.type]}`;
    imageMime = file.type;
    await uploadFile("ad-images", imagePath, new Uint8Array(await file.arrayBuffer()), file.type);
  }

  await sqlite
    .prepare(
      `insert into ads (id, title, body, sponsor, link_url, image_path, image_mime, active, created_at, starts_at, ends_at)
       values (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    )
    .run(newId("adv"), title, body, sponsor, link, imagePath, imageMime, Date.now(), startsAt, endsAt);

  refresh();
  done("/admin/ads", "Advertisement published.");
}

export async function toggleAd(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await sqlite.prepare("update ads set active = 1 - active where id = ?").run(id);
  refresh();
  done("/admin/ads", "Advertisement updated.");
}

export async function deleteAd(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const ad = await getAd(id);
  if (ad) {
    await sqlite.prepare("delete from ads where id = ?").run(id);
    await removeFileQuietly("ad-images", ad.image_path);
  }
  refresh();
  done("/admin/ads", "Advertisement deleted.");
}
