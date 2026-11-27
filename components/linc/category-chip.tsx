import Link from "next/link";
import { categoryChipStyle } from "@/lib/category-colors";

/** Category label in the category's own colour (set `colored={false}` for the plain style). */
export function CategoryChip({
  slug,
  label,
  colored = true,
  href,
  className = "",
}: {
  slug: string;
  label: string;
  colored?: boolean;
  href?: string;
  className?: string;
}) {
  const base = `rounded-full border px-2 py-0.5 ${colored ? "font-semibold" : "border-line"} ${className}`;
  const style = colored ? categoryChipStyle(slug) : undefined;
  return href ? (
    <Link href={href} className={`${base} transition hover:opacity-80`} style={style}>
      {label}
    </Link>
  ) : (
    <span className={base} style={style}>
      {label}
    </span>
  );
}
