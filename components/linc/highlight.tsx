import { highlightParts } from "@/lib/search";

/** Wraps matched search terms in <mark>; renders plain text when there are none. */
export function Highlight({ text, terms }: { text: string; terms?: string[] }) {
  if (!terms?.length) return <>{text}</>;
  return (
    <>
      {highlightParts(text, terms).map((part, i) =>
        part.match ? (
          <mark key={i} className="rounded-sm bg-linc-100 px-0.5 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
