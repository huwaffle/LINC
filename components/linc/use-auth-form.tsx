"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertIcon } from "./icons";

/** How to read one box of an auth form, and what a bad value should say. */
export type AuthField = {
  name: string;
  label: string;
  /** Returns the problem with the current value, or null when it is fine. */
  check: (value: string, form: HTMLFormElement) => string | null;
};

// useLayoutEffect warns during SSR; the effect body only matters after paint.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/** The message that appears beside a box that could not pass its check. */
export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-start gap-1.5 text-[12px] font-medium text-rose-600"
    >
      <AlertIcon className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      <span>{message}</span>
    </p>
  );
}

/**
 * Field validation with the LINC look. Failing boxes carry the red,
 * shaking `.field-invalid` class (globals.css) and their messages render
 * beside them. A message disappears as soon as its check passes again, and
 * every failed submit attempt replays the shake.
 *
 * `serverFlags` names boxes a server rejection (redirected back with
 * ?error=) already pointed at: they start flagged without a message, until
 * the next submit attempt re-validates everything.
 */
export function useAuthForm(fields: AuthField[], serverFlags: string[] = []) {
  const formRef = useRef<HTMLFormElement>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<string[]>(serverFlags);
  const [attempt, setAttempt] = useState(0);

  // React keeps the class between attempts, so the shake needs a manual
  // restart. This runs before the browser paints, so each attempt shakes
  // exactly once, cleanly.
  useIsomorphicLayoutEffect(() => {
    if (attempt === 0) return;
    const flaggedInputs =
      formRef.current?.querySelectorAll<HTMLInputElement>(".field-invalid") ?? [];
    for (const input of flaggedInputs) {
      input.classList.remove("field-invalid");
      // Reading a layout property between the two class changes forces the
      // recalculation that restarts the animation.
      void input.offsetWidth;
      input.classList.add("field-invalid");
    }
  }, [attempt]);

  /** Form-level onChange: drops a message once its check passes again. */
  function handleChange() {
    const form = formRef.current;
    if (!form) return;
    setMessages((previous) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const [name, message] of Object.entries(previous)) {
        const field = fields.find((candidate) => candidate.name === name);
        const input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
        if (field && input && field.check(input.value, form) !== null) {
          next[name] = message;
        } else {
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }

  /**
   * Validates every field, records the messages, shakes the failing boxes
   * and focuses the first one. Returns whether the form may be submitted.
   */
  function guard(): boolean {
    const form = formRef.current;
    if (!form) return true;

    const next: Record<string, string> = {};
    let firstBad: HTMLInputElement | null = null;
    for (const field of fields) {
      const input = form.querySelector<HTMLInputElement>(`input[name="${field.name}"]`);
      if (!input) continue;
      const message = field.check(input.value, form);
      if (message) {
        next[field.name] = message;
        firstBad ??= input;
      }
    }

    setFlagged([]);
    setMessages(next);
    if (Object.keys(next).length === 0) return true;
    setAttempt((count) => count + 1);
    firstBad?.focus();
    return false;
  }

  /** Whether a box should carry the red, shaking `.field-invalid` class. */
  function isInvalid(name: string): boolean {
    return messages[name] !== undefined || flagged.includes(name);
  }

  return { formRef, messages, isInvalid, guard, handleChange };
}
