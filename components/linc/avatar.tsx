const TONES = [
  { bg: "#eef8f2", fg: "#0f6b45" },
  { bg: "#eef2fb", fg: "#31548f" },
  { bg: "#fdf3e7", fg: "#8a5a1d" },
  { bg: "#fbeeee", fg: "#8f3a3a" },
  { bg: "#f4effc", fg: "#5c3d8f" },
  { bg: "#e9f6f7", fg: "#1f6b72" },
];

function toneFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

export function Avatar({
  name,
  anonymous = false,
  size = 36,
  className = "",
  src,
}: {
  name: string;
  anonymous?: boolean;
  size?: number;
  className?: string;
  /** Uploaded profile picture. Initials remain the fallback. */
  src?: string | null;
}) {
  const tone = anonymous ? { bg: "#f2f2f2", fg: "#8a8a8a" } : toneFor(name);
  const label = anonymous ? "?" : name.trim().charAt(0).toUpperCase();
  const showImage = Boolean(src) && !anonymous;

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold select-none ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: tone.bg,
        color: tone.fg,
        fontSize: Math.round(size * 0.4),
      }}
      aria-hidden="true"
    >
      {showImage ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src ?? undefined} alt="" className="h-full w-full object-cover" />
      ) : (
        label
      )}
    </span>
  );
}
