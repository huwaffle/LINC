import Link from "next/link";
import { updateAccount } from "@/app/actions/profile";
import { Avatar } from "@/components/linc/avatar";
import { Notice } from "@/components/linc/empty-state";
import { PageHeader } from "@/components/linc/page-header";
import { requireUser } from "@/lib/auth/session";
import { ensureUser } from "@/lib/db/users";
import { getAccountById } from "@/lib/db/queries";
import { messageFrom } from "@/lib/redirects";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await requireUser("/settings");
  await ensureUser(session);
  const account = await getAccountById(session.id);
  const sp = await searchParams;
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });

  const displayName = account?.display_name ?? session.displayName;
  const avatar =
    account?.avatar_path !== null && account?.avatar_path !== undefined
      ? `/api/avatars/${session.id}`
      : undefined;

  return (
    <div>
      <PageHeader
        title="Account settings"
        subtitle="Nickname and profile picture"
        backHref="/me"
        backLabel="My activity"
      />

      {message.text && (
        <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
      )}

      <section className="flex items-center gap-4 border-b border-line px-4 py-5">
        <Avatar name={displayName} src={avatar} size={80} className="ring-1 ring-line" />
        <div className="min-w-0">
          <h2 className="truncate text-[20px] font-bold tracking-[-0.02em] text-ink">
            {displayName}
          </h2>
          <p className="text-[14px] text-neutral-500">@{session.username}</p>
          <p className="mt-1 text-[12px] text-neutral-400">
            Your username is permanent. Everything else here is yours to change.
          </p>
        </div>
      </section>

      <form action={updateAccount} className="space-y-5 px-4 py-5">
        <div>
          <label htmlFor="displayName" className="block text-[12px] font-semibold text-neutral-600">
            Nickname
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            maxLength={60}
            defaultValue={displayName}
            className="mt-1.5 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[15px] text-ink outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50"
          />
          <p className="mt-1.5 text-[12px] text-neutral-500">
            Shown on your posts, replies, and public profile. Username @{session.username} stays the
            same.
          </p>
        </div>

        <div>
          <label htmlFor="avatar" className="block text-[12px] font-semibold text-neutral-600">
            Profile picture
          </label>
          <input
            id="avatar"
            name="avatar"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="mt-1.5 block w-full text-[13px] text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-ink"
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            PNG, JPEG, WebP, or GIF · max 5 MB
          </p>
          {avatar && (
            <label className="mt-3 flex items-center gap-2 text-[12px] text-neutral-600">
              <input
                type="checkbox"
                name="removeAvatar"
                className="h-4 w-4 rounded border-line accent-linc-600"
              />
              Remove my current picture
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <Link
            href={`/u/${session.username}`}
            className="text-[12px] font-semibold text-linc-700 transition hover:underline"
          >
            View public profile
          </Link>
          <button
            type="submit"
            className="rounded-full bg-linc-600 px-5 py-2 text-[14px] font-semibold text-white transition hover:bg-linc-700"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
