import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
      <span className="text-[30px] font-black tracking-[-0.04em] text-linc-600">LINC</span>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-linc-600">404</p>
      <h1 className="mt-1.5 text-[20px] font-bold tracking-[-0.02em] text-ink">
        This page is not available
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
        The post may have been removed, returned to its author, or moved to a different category.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-linc-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-linc-700"
      >
        Back to the feed
      </Link>
    </div>
  );
}
