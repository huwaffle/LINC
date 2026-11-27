import type { EntryStatus } from "@/lib/db/schema";

const STYLES: Record<EntryStatus, string> = {
  draft: "text-neutral-400",
  pending: "text-amber-600",
  published: "text-linc-600",
  rejected: "text-rose-600",
  redacted: "text-neutral-400",
};

export function StatusBadge({ status }: { status: EntryStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide ${STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status === "redacted" ? "removed" : status}
    </span>
  );
}
