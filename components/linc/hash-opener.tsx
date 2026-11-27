"use client";

import { useEffect } from "react";

/**
 * Opens any collapsed <details> that contains the element named in the URL
 * hash, so links like #comment-123 still land on a visible comment.
 */
export function HashOpener() {
  useEffect(() => {
    const reveal = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      let node: HTMLElement | null = target.parentElement;
      while (node) {
        if (node instanceof HTMLDetailsElement) node.open = true;
        node = node.parentElement;
      }
      target.scrollIntoView({ block: "center" });
    };

    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);

  return null;
}
