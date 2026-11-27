"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { SearchIcon } from "./icons";

type Suggestion = {
  kind?: "category";
  id: string;
  title: string;
  categorySlug: string;
  categoryLabel: string;
};

/**
 * Search field with typeahead. Suggestions are published post titles; picking
 * one fills the box and submits the same GET form, so filters are preserved.
 */
export function SearchInput({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    setValue(defaultValue);
    setOpen(false);
  }, [defaultValue]);

  const focused = useRef(false);

  const load = useCallback(async (term: string, signal?: AbortSignal, reveal = true) => {
    try {
      const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal });
      if (!response.ok) return;
      const data = (await response.json()) as {
        items?: Suggestion[];
        categories?: Array<{ slug: string; label: string; total: number }>;
      };
      const cats: Suggestion[] = (data.categories ?? []).map((c) => ({
        kind: "category",
        id: `cat:${c.slug}`,
        title: c.label,
        categorySlug: c.slug,
        categoryLabel: `${c.total} post${c.total === 1 ? "" : "s"}`,
      }));
      const next = [...cats, ...(Array.isArray(data.items) ? data.items : [])];
      setItems(next);
      setActive(-1);
      if (reveal) setOpen(next.length > 0);
    } catch {
      // Aborted or offline; leave the previous suggestions alone.
    }
  }, []);

  const pending = useRef<{ timer?: number; controller?: AbortController }>({});

  // Suggestions are fetched only in response to typing, never on mount, so a page
  // that loads with a query already filled in does not pop the list open again.
  function onType(next: string) {
    setValue(next);
    window.clearTimeout(pending.current.timer);
    pending.current.controller?.abort();

    const term = next.trim();
    if (term.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    pending.current.controller = controller;
    pending.current.timer = window.setTimeout(async () => await load(term, controller.signal), 180);
  }

  useEffect(() => {
    const state = pending.current;
    return () => {
      window.clearTimeout(state.timer);
      state.controller?.abort();
    };
  }, []);

  function choose(item: Suggestion) {
    if (item.kind === "category") {
      window.clearTimeout(pending.current.timer);
      pending.current.controller?.abort();
      setOpen(false);
      window.location.assign(`/c/${item.categorySlug}`);
      return;
    }
    const input = inputRef.current;
    window.clearTimeout(pending.current.timer);
    pending.current.controller?.abort();
    setItems([]);
    setValue(item.title);
    setOpen(false);
    setActive(-1);
    if (input) {
      input.value = item.title;
      input.form?.requestSubmit();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current <= 0 ? items.length - 1 : current - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(items[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2">
      <SearchIcon className="h-[18px] w-[18px] shrink-0 text-neutral-400" />
      <label htmlFor="q" className="sr-only">
        Keywords
      </label>
      <input
        ref={inputRef}
        id="q"
        name="q"
        value={value}
        onChange={(event) => onType(event.target.value)}
        onFocus={() => {
          focused.current = true;
          if (items.length > 0) setOpen(true);
        }}
        onBlur={() => {
          focused.current = false;
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        placeholder="Search the campus feed"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-option-${active}` : undefined}
        className="w-full bg-transparent text-[15px] text-ink placeholder:text-neutral-400 outline-none"
      />

      <span className="sr-only" role="status" aria-live="polite">
        {open && items.length > 0
          ? `${items.length} suggestion${items.length === 1 ? "" : "s"} available. Use the up and down arrow keys to review.`
          : ""}
      </span>

      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg"
        >
          {items.map((item, index) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="option"
                id={`${listId}-option-${index}`}
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
                onMouseEnter={() => setActive(index)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                  index === active ? "bg-neutral-100" : "bg-white"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {item.title}
                  </span>
                  <span className="block text-[11px] text-neutral-400">{item.categoryLabel}</span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
                  {item.kind === "category" ? "Category" : "Post"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
