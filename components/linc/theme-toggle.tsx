"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "./icons";

const STORAGE_KEY = "linc-theme";

/**
 * The inline boot script in the root layout applies the saved theme before
 * paint. This control only mirrors that state after hydration and flips it.
 */
export function ThemeToggle({
  showLabel = false,
  className = "",
}: {
  showLabel?: boolean;
  className?: string;
}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private modes can reject storage; the current tab still switches.
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={dark}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-xl px-2.5 text-[13px] font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-ink ${showLabel ? "lg:justify-start" : ""} ${className}`}
    >
      {dark ? (
        <SunIcon className="h-[18px] w-[18px] shrink-0" />
      ) : (
        <MoonIcon className="h-[18px] w-[18px] shrink-0" />
      )}
      {showLabel && (
        <span className="hidden truncate lg:inline">{dark ? "Light mode" : "Dark mode"}</span>
      )}
    </button>
  );
}
