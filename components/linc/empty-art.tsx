export type EmptyArtVariant =
  | "feed"
  | "search"
  | "saved"
  | "drafts"
  | "activity"
  | "events"
  | "profile"
  | "queue"
  | "receipt"
  | "locked";

const CARD = "fill-canvas stroke-linc-400";
const SOFT = "fill-linc-50 stroke-linc-300";
const LINE = "stroke-linc-300";
const ACCENT = "fill-linc-500";

/**
 * One lightweight, dependency-free illustration per empty context. Everything
 * is drawn with the semantic green tokens, so light and dark mode share the
 * same artwork without a second asset set.
 */
export function EmptyArt({
  variant = "feed",
  className = "",
}: {
  variant?: EmptyArtVariant;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 128 96"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M20 50c0-20 19-30 44-30s44 10 44 30-19 30-44 30-44-10-44-30Z"
        className="fill-linc-50/70"
      />

      {variant === "feed" && (
        <>
          <rect x="30" y="34" width="58" height="38" rx="7" className={`${SOFT} opacity-70`} />
          <rect x="40" y="25" width="58" height="38" rx="7" className={CARD} />
          <path d="M50 37h28M50 44h34M50 51h22" className={LINE} />
          <circle cx="90" cy="59" r="7" className="fill-linc-100 stroke-linc-400" />
          <path d="M87 59h6M90 56v6" className="stroke-linc-500" />
        </>
      )}

      {variant === "search" && (
        <>
          <rect x="26" y="26" width="54" height="38" rx="7" className={CARD} />
          <path d="M36 38h24M36 45h30M36 52h18" className={LINE} />
          <circle cx="82" cy="56" r="17" className="fill-canvas stroke-linc-500" strokeWidth={3.5} />
          <path d="m94 68 9 9" className="stroke-linc-500" strokeWidth={4} />
          <circle cx="98" cy="30" r="3" className={ACCENT} />
          <circle cx="34" cy="76" r="2.5" className="fill-linc-300" />
        </>
      )}

      {variant === "saved" && (
        <>
          <rect x="32" y="20" width="54" height="52" rx="8" className={CARD} />
          <path d="M42 32h24M42 39h30M42 46h20" className={LINE} />
          <path d="M82 34h20v34l-10-6-10 6z" className={SOFT} />
          <path d="m92 42 2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.7 2.5.9-5.3-3.8-3.7 5.3-.8Z" className={ACCENT} />
        </>
      )}

      {variant === "drafts" && (
        <>
          <path d="M38 18h38l14 14v46H38z" className={CARD} />
          <path d="M76 18v14h14" className="stroke-linc-400" />
          <path d="M48 44h28M48 52h22M48 60h16" className={LINE} />
          <path d="m78 66 20-20 7 7-20 20-9 2z" className={SOFT} />
          <path d="m78 66 7 7" className="stroke-linc-500" />
          <path d="m98 46 3-3a2.5 2.5 0 0 1 4 4l-3 3z" className={ACCENT} />
        </>
      )}

      {variant === "activity" && (
        <>
          <path d="M46 54 68 38M48 60l26 6" className={LINE} />
          <circle cx="42" cy="56" r="11" className={SOFT} />
          <circle cx="74" cy="34" r="8" className={CARD} />
          <circle cx="80" cy="66" r="10" className={CARD} />
          <circle cx="42" cy="56" r="3" className={ACCENT} />
          <circle cx="74" cy="34" r="2.5" className="fill-linc-400" />
          <circle cx="80" cy="66" r="2.5" className="fill-linc-400" />
          <path d="M93 26v-9M104 31l6-6M100 74l7 6M66 16l1-7" className="stroke-linc-400" />
        </>
      )}

      {variant === "events" && (
        <>
          <rect x="30" y="24" width="62" height="54" rx="9" className={CARD} />
          <path d="M30 39h62" className="stroke-linc-300" />
          <path d="M46 18v12M76 18v12" className="stroke-linc-400" strokeWidth={3} />
          <circle cx="48" cy="51" r="3" className={ACCENT} />
          <circle cx="62" cy="51" r="3" className="fill-linc-300" />
          <circle cx="76" cy="51" r="3" className={ACCENT} />
          <circle cx="48" cy="64" r="3" className="fill-linc-300" />
          <circle cx="62" cy="64" r="3" className={ACCENT} />
          <path d="m86 62 4 4 7-8" className="stroke-linc-500" strokeWidth={3} />
        </>
      )}

      {variant === "profile" && (
        <>
          <rect x="30" y="20" width="60" height="54" rx="9" className={CARD} />
          <circle cx="60" cy="38" r="10" className={SOFT} />
          <path d="M42 66c2-10 9-16 18-16s16 6 18 16" className={SOFT} />
          <circle cx="92" cy="28" r="5" className="fill-linc-100 stroke-linc-400" />
          <path d="M90 28h4M92 26v4" className="stroke-linc-500" />
          <circle cx="98" cy="70" r="3" className="fill-linc-300" />
        </>
      )}

      {variant === "queue" && (
        <>
          <path d="M28 46 38 24h52l10 22v26H28z" className={CARD} />
          <path d="M28 46h18l4 8h26l4-8h18" className="stroke-linc-400" />
          <path d="M50 34h28M54 41h20" className={LINE} />
          <circle cx="90" cy="32" r="4" className={ACCENT} />
          <path d="m98 42 5-5M101 53h7M96 61l4 5" className="stroke-linc-300" />
        </>
      )}

      {variant === "receipt" && (
        <>
          <path
            d="M34 24h60v14a7 7 0 0 0 0 14v22H34V52a7 7 0 0 0 0-14z"
            className={CARD}
          />
          <path d="M50 36h28M50 44h20M50 57h24M50 64h14" className={LINE} />
          <path d="M86 26v46" className="stroke-linc-300" strokeDasharray="3 5" />
          <circle cx="94" cy="32" r="3" className={ACCENT} />
        </>
      )}

      {variant === "locked" && (
        <>
          <rect x="42" y="42" width="44" height="34" rx="8" className={SOFT} />
          <path d="M52 42v-9a12 12 0 0 1 24 0v9" className="stroke-linc-400" strokeWidth={3.5} />
          <circle cx="64" cy="56" r="3.5" className={ACCENT} />
          <path d="M64 59v8" className="stroke-linc-500" strokeWidth={3} />
          <path d="M30 32l6 6M102 32l-6 6M64 14v7" className="stroke-linc-300" />
        </>
      )}
    </svg>
  );
}
