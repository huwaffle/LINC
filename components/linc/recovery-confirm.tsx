"use client";

import { FieldError, useAuthForm, type AuthField } from "./use-auth-form";

const FIELDS: AuthField[] = [
  {
    name: "saved",
    label: "I have saved my recovery code.",
    // A checkbox's value is always "on"; read its checked state instead.
    check: (_value, form) =>
      form.querySelector<HTMLInputElement>('input[name="saved"]')?.checked
        ? null
        : "Check this box to confirm you saved the code.",
  },
];

/** The last step of signing up and of resetting a password: confirm the code is stored. */
export function RecoveryConfirm({ to }: { to: string }) {
  const { formRef, messages, isInvalid, guard, handleChange } = useAuthForm(FIELDS);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!guard()) event.preventDefault();
  }

  return (
    <form
      ref={formRef}
      action="/api/auth/recovery-ack"
      method="post"
      noValidate
      onSubmit={onSubmit}
      onChange={handleChange}
      className="mt-6 space-y-3"
    >
      <input type="hidden" name="to" value={to} />
      <label htmlFor="saved" className="flex items-start gap-2 text-[12px] text-ink">
        <input
          id="saved"
          name="saved"
          type="checkbox"
          required
          className={`mt-0.5${isInvalid("saved") ? " field-invalid" : ""}`}
          aria-invalid={isInvalid("saved") || undefined}
          aria-describedby={messages.saved ? "saved-error" : undefined}
        />
        <span>I have saved my recovery code.</span>
      </label>
      {messages.saved && <FieldError id="saved-error" message={messages.saved} />}
      <button
        type="submit"
        className="w-full rounded-full bg-linc-600 px-4 py-2.5 text-[15px] font-semibold text-white transition hover:bg-linc-700"
      >
        Continue
      </button>
    </form>
  );
}
