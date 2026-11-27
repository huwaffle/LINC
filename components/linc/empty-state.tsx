import { EmptyArt, type EmptyArtVariant } from "./empty-art";

export function EmptyState({
  title,
  description,
  action,
  art = "feed",
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Picks the small line illustration shown above the copy. */
  art?: EmptyArtVariant;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <EmptyArt variant={art} className="mx-auto h-24 w-32" />
      <p className="mt-3 text-[15px] font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[15px] leading-relaxed text-neutral-500">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({
  kind = "info",
  children,
}: {
  kind?: "info" | "success" | "warning" | "error";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-neutral-300 text-neutral-600",
    success: "border-linc-500 text-linc-700",
    warning: "border-amber-400 text-amber-800",
    error: "border-rose-400 text-rose-700",
  }[kind];

  return (
    <div
      className={`mx-4 my-3 border-l-2 py-1.5 pl-3 text-[13px] leading-relaxed ${styles}`}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {children}
    </div>
  );
}
