"use server";

import { revalidatePath } from "next/cache";
import { getSession, startSession } from "@/lib/auth/session";
import { sqlite } from "@/lib/db/client";
import { displayNameTaken, ensureUser, getStoredUser, newId } from "@/lib/db/users";
import { hitLimit } from "@/lib/rate-limit";
import { scheduleContentScan } from "@/lib/moderation/safety";
import { done, fail } from "@/lib/redirects";
import { accountSchema, firstError } from "@/lib/validation";
import { removeFileQuietly, uploadFile } from "@/lib/storage";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Updates the signed-in account's nickname and profile picture. The username
 * is an immutable login identifier and is deliberately never read from here.
 */
export async function updateAccount(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) fail("/login", "Sign in to edit your account.");

  if (!await hitLimit(`account:${session.id}`, 12, 10 * 60_000)) {
    fail("/settings", "You are changing your account too quickly. Try again shortly.");
  }

  const parsed = accountSchema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) fail("/settings", firstError(parsed.error));
  const displayName = parsed.data.displayName;

  if (await displayNameTaken(displayName, session.id)) fail("/settings", "That username is already taken.");

  await ensureUser(session);
  const stored = await getStoredUser(session.id);
  if (!stored || stored.is_anonymous) fail("/settings", "That account cannot be edited.");

  let avatarPath = stored.avatar_path;
  let avatarMime = stored.avatar_mime;
  let uploadedPath: string | null = null;

  const file = formData.get("avatar");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_AVATAR_BYTES) {
      fail("/settings", "Profile pictures must be 5 MB or smaller.");
    }
    if (!ALLOWED_AVATAR_MIME.has(file.type)) {
      fail("/settings", "Profile pictures must be a PNG, JPEG, WebP, or GIF image.");
    }

    uploadedPath = `${newId("avatar")}.${EXTENSION_BY_MIME[file.type]}`;
    await uploadFile("avatars", uploadedPath, new Uint8Array(await file.arrayBuffer()), file.type);
    avatarPath = uploadedPath;
    avatarMime = file.type;
  } else if (formData.get("removeAvatar") === "on") {
    avatarPath = null;
    avatarMime = null;
  }

  const previousAvatar = stored.avatar_path;
  await sqlite
    .prepare("update users set display_name = ?, avatar_path = ?, avatar_mime = ? where id = ?")
    .run(displayName, avatarPath, avatarMime, session.id);

  if (previousAvatar !== avatarPath) await removeFileQuietly("avatars", previousAvatar);

  // The header reads the nickname from the session token, so re-sign it with
  // the new value; the database copy is what survives the next login.
  await startSession({ ...session, displayName });

  scheduleContentScan("account", session.id);

  revalidatePath("/");
  revalidatePath("/me");
  revalidatePath("/settings");
  revalidatePath("/submit");
  revalidatePath(`/u/${session.username}`);

  done("/settings", "Your account has been updated.");
}
