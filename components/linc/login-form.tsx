"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatLockCountdown } from "@/lib/auth/login-countdown";
import { FieldError, useAuthForm, type AuthField } from "./use-auth-form";

const MIN_PASSWORD_LENGTH = 8;

const FIELDS: AuthField[] = [
  {
    name: "username",
    label: "Email or student number",
    check: (value) => (value.trim() ? null : "Enter your email or student number."),
  },
  {
    name: "password",
    label: "Password",
    check: (value) => {
      if (!value) return "Enter your password.";
      if (value.length < MIN_PASSWORD_LENGTH)
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
      return null;
    },
  },
];

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-neutral-400 outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50";
const labelClass = "mb-1 block text-[12px] font-semibold text-neutral-500";

export function LoginForm({
  next,
  error,
  lockMs = 0,
}: {
  next?: string;
  error?: string;
  lockMs?: number;
}) {
  // A rejection redirects back with ?error=: the page keeps the inline notice
  // above the form. Credential errors flag both boxes; lockout errors do not.
  const isLockout =
    lockMs > 0 || error?.startsWith("Too many unsuccessful sign-in attempts") === true;
  const { formRef, messages, isInvalid, guard, handleChange } = useAuthForm(
    FIELDS,
    error && !isLockout ? ["username", "password"] : [],
  );

  // The server sends the remaining lock duration; counting down locally keeps
  // the button disabled until the window is actually over.
  const [remainingLockMs, setRemainingLockMs] = useState(lockMs);
  useEffect(() => {
    if (lockMs <= 0) {
      setRemainingLockMs(0);
      return;
    }
    const deadline = Date.now() + lockMs;
    const tick = () => setRemainingLockMs(Math.max(0, deadline - Date.now()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [lockMs]);

  /** Shared plumbing for both boxes: red class plus the aria wiring. */
  function fieldProps(name: string) {
    return {
      className: `${inputClass}${isInvalid(name) ? " field-invalid" : ""}`,
      "aria-invalid": isInvalid(name) || undefined,
      "aria-describedby": messages[name] ? `${name}-error` : undefined,
    };
  }

  function onSubmit() {
    // Empty and short values still go to the server: every failed sign-in,
    // including a blank submission, consumes one of the five attempts.
    guard();
  }

  return (
    <form
      ref={formRef}
      action="/api/auth/login"
      method="post"
      noValidate
      onSubmit={onSubmit}
      onChange={handleChange}
      className="mt-8 space-y-3"
    >
      <input type="hidden" name="next" value={next ?? "/"} />
      <div>
        <label htmlFor="username" className={labelClass}>
          Email or student number
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          placeholder="name@dlsau.edu.ph or 20231001"
          required
          {...fieldProps("username")}
        />
        {messages.username && <FieldError id="username-error" message={messages.username} />}
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="At least 8 characters"
          required
          minLength={8}
          {...fieldProps("password")}
        />
        {messages.password && <FieldError id="password-error" message={messages.password} />}
        <p className="mt-1.5 flex justify-between text-[11px] text-neutral-400">
          <span>Minimum 8 characters.</span>
          <Link href="/forgot-password" className="font-semibold text-linc-700 hover:underline">
            Forgot password?
          </Link>
        </p>
      </div>
      {remainingLockMs > 0 && (
        <p
          role="timer"
          aria-live="polite"
          className="rounded-xl bg-rose-50 px-3 py-2 text-center text-[13px] font-semibold text-rose-700"
        >
          Sign-in locked · try again in{" "}
          <span className="font-mono">{formatLockCountdown(remainingLockMs)}</span>
        </p>
      )}
      {lockMs > 0 && remainingLockMs === 0 && (
        <p role="status" className="rounded-xl bg-linc-50 px-3 py-2 text-center text-[13px] font-semibold text-linc-700">
          Lock expired. You can try again now.
        </p>
      )}
      <button
        type="submit"
        disabled={remainingLockMs > 0}
        className="w-full rounded-full bg-linc-600 px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-linc-700 disabled:cursor-not-allowed disabled:bg-linc-300"
      >
        {remainingLockMs > 0
          ? `Locked · ${formatLockCountdown(remainingLockMs)}`
          : "Sign in"}
      </button>
    </form>
  );
}
