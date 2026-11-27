"use client";

import { FieldError, useAuthForm, type AuthField } from "./use-auth-form";

const MIN_PASSWORD_LENGTH = 8;

const FIELDS: AuthField[] = [
  {
    name: "username",
    label: "Email or student number",
    check: (value) => (value.trim() ? null : "Enter your email or student number."),
  },
  {
    name: "code",
    label: "Recovery code",
    check: (value) => {
      // Dashes and spaces are fine; the code itself is 16 letters and digits.
      const code = value.replace(/[^A-Za-z0-9]/g, "");
      if (!code) return "Enter your recovery code.";
      return code.length === 16 ? null : "Recovery codes are 16 characters, like XXXX-XXXX-XXXX-XXXX.";
    },
  },
  {
    name: "password",
    label: "New password",
    check: (value) => {
      if (!value) return "Enter a new password.";
      return value.length >= MIN_PASSWORD_LENGTH
        ? null
        : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    },
  },
  {
    name: "confirm",
    label: "Confirm new password",
    check: (value, form) => {
      if (!value) return "Re-enter your new password here.";
      const password = form.querySelector<HTMLInputElement>('input[name="password"]');
      return value === password?.value ? null : "Passwords do not match.";
    },
  },
];

/** Picks the boxes a server rejection talks about, so only those start flagged. */
function boxesForMessage(message: string): string[] {
  const text = message.toLowerCase();
  if (text.includes("passwords do not match")) return ["confirm"];
  if (text.includes("password")) return ["password"];
  if (text.includes("recovery code")) return ["username", "code"];
  return [];
}

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-neutral-400 outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50";
const labelClass = "mb-1 block text-[12px] font-semibold text-neutral-500";

export function ResetForm({ error }: { error?: string }) {
  // A rejection redirects back with ?error=: the page keeps the inline notice
  // above the form, and the boxes it talks about start flagged.
  const { formRef, messages, isInvalid, guard, handleChange } = useAuthForm(
    FIELDS,
    error ? boxesForMessage(error) : [],
  );

  /** Shared plumbing for every box: red class plus the aria wiring. */
  function fieldProps(name: string, extra = "") {
    return {
      className: `${inputClass}${extra}${isInvalid(name) ? " field-invalid" : ""}`,
      "aria-invalid": isInvalid(name) || undefined,
      "aria-describedby": messages[name] ? `${name}-error` : undefined,
    };
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!guard()) event.preventDefault();
  }

  return (
    <form
      ref={formRef}
      action="/api/auth/reset"
      method="post"
      noValidate
      onSubmit={onSubmit}
      onChange={handleChange}
      className="mt-6 space-y-3"
    >
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
        <label htmlFor="code" className={labelClass}>
          Recovery code
        </label>
        <input
          id="code"
          name="code"
          autoComplete="off"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          required
          {...fieldProps("code", " font-mono uppercase")}
        />
        {messages.code && <FieldError id="code-error" message={messages.code} />}
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
          minLength={8}
          {...fieldProps("password")}
        />
        {messages.password && <FieldError id="password-error" message={messages.password} />}
      </div>
      <div>
        <label htmlFor="confirm" className={labelClass}>
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          {...fieldProps("confirm")}
        />
        {messages.confirm && <FieldError id="confirm-error" message={messages.confirm} />}
      </div>
      <button
        type="submit"
        className="w-full rounded-full bg-linc-600 px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-linc-700"
      >
        Reset password
      </button>
    </form>
  );
}
