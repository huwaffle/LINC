import Link from "next/link";
import { ArrowLeftIcon } from "./icons";

/**
 * One header shape for every section: a 56px title row plus an optional
 * controls row. Keeping the same height and padding everywhere stops the feed
 * from jumping when the reader moves between Home, Search, and the rest.
 */
export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      data-page-header
      className="sticky top-14 z-20 border-b border-line bg-white/90 backdrop-blur md:top-0"
    >
      <div className="flex h-14 items-center gap-2 px-4">
        {backHref && (
          <Link
            href={backHref}
            aria-label={backLabel ?? "Back"}
            className="-ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink transition hover:bg-neutral-100"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-black leading-tight tracking-[-0.03em] text-ink">
            {title}
          </h1>
          {subtitle && <p className="truncate text-[12px] leading-tight text-neutral-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
      {children && <div className="flex h-12 items-center px-4">{children}</div>}
    </div>
  );
}
