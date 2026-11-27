import Link from "next/link";
import { submitEntry } from "@/app/actions/entries";
import { saveDraft } from "@/app/actions/posts";
import { Avatar } from "@/components/linc/avatar";
import { Notice } from "@/components/linc/empty-state";
import { PageHeader } from "@/components/linc/page-header";
import { PaperclipIcon } from "@/components/linc/icons";
import { CategorySuggest } from "@/components/linc/category-suggest";
import { requireUser } from "@/lib/auth/session";
import { getAccountById, listCategories } from "@/lib/db/queries";
import { avatarSrc } from "@/lib/avatars";
import { messageFrom } from "@/lib/redirects";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const session = await requireUser("/submit");
  const account = await getAccountById(session.id);
  const myAvatar = avatarSrc(session.id, Boolean(account?.avatar_path));
  const sp = await searchParams;
  const categories = await listCategories();
  const message = messageFrom({
    error: typeof sp.error === "string" ? sp.error : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });

  return (
    <div>
      <PageHeader
        title="New post"
        backHref="/"
        backLabel="Cancel"
        actions={
          <span className="text-[12px] text-neutral-400">Drafts go to admin review</span>
        }
      />

      {message.text && (
        <Notice kind={message.kind === "error" ? "error" : "success"}>{message.text}</Notice>
      )}

      <form action={submitEntry} className="px-4 py-4">
        <div className="flex gap-3">
          <Avatar name={account?.display_name ?? session.displayName} src={myAvatar} size={40} className="mt-1" />
          <div className="min-w-0 flex-1">
            <label htmlFor="title" className="sr-only">
              Title
            </label>
            <input
              id="title"
              name="title"
              required
              placeholder="Title — a short, specific summary"
              className="w-full bg-transparent text-[20px] font-semibold tracking-[-0.02em] text-ink placeholder:text-neutral-300 outline-none"
            />

            <label htmlFor="body" className="sr-only">
              Details
            </label>
            <textarea
              id="body"
              name="body"
              required
              rows={9}
              placeholder="Add details…"
              className="mt-3 w-full resize-none bg-transparent text-[15px] leading-[1.55] text-neutral-800 placeholder:text-neutral-300 outline-none"
            />
          </div>
        </div>

        <div className="mt-2 border-t border-line pt-4">
          <div className="flex flex-wrap gap-2">
            <div className="flex-1">
              <label htmlFor="categoryId" className="block text-[11px] font-semibold text-neutral-500">
                Category
              </label>
              <select
                id="categoryId"
                name="categoryId"
                className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-linc-400"
              >
                <option value="">Let LINC choose for me</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <CategorySuggest />

          <div className="mt-4">
            <label
              htmlFor="attachment"
              className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-neutral-600"
            >
              <PaperclipIcon className="h-[18px] w-[18px]" />
              Attachment <span className="font-normal text-neutral-400">(optional)</span>
            </label>
            <input
              id="attachment"
              name="attachment"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,application/pdf"
              className="mt-2 block w-full text-[13px] text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-ink"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              PNG, JPEG, WebP, GIF, MP4, WebM, or PDF · max 25 MB
            </p>
          </div>

          {session.role !== "admin" && (
          <label className="mt-4 flex items-start gap-3 rounded-xl bg-canvas px-3 py-3">
            <input
              type="checkbox"
              name="isAnonymous"
              className="mt-0.5 h-4 w-4 rounded border-line accent-linc-600"
            />
            <span className="text-[13px]">
              <span className="font-semibold text-ink">Submit anonymously</span>
              <span className="mt-0.5 block leading-relaxed text-neutral-500">
                Stored under a generated pseudonym instead of your account. The USC administrator
                still reviews it.
              </span>
            </span>
          </label>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-[12px] text-neutral-400">
              Signed in as <span className="font-semibold text-neutral-600">{account?.display_name ?? session.displayName}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                formAction={saveDraft}
                className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink transition hover:bg-neutral-50"
              >
                Save draft
              </button>
              <button
                type="submit"
                className="rounded-full bg-linc-600 px-5 py-2 text-[14px] font-semibold text-white transition hover:bg-linc-700"
              >
                Submit for review
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
