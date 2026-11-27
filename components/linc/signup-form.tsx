"use client";

import { TermsAgreement } from "./terms-agreement";
import { FieldError, useAuthForm, type AuthField } from "./use-auth-form";

const MIN_PASSWORD_LENGTH = 8;
const SCHOOL_EMAIL = /^[a-z0-9._%+-]+@dlsau\.edu\.ph$/i;

const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-neutral-400 outline-none transition focus:border-linc-400 focus:ring-4 focus:ring-linc-50";
const labelClass = "mb-1 block text-[12px] font-semibold text-neutral-500";

const FIELDS: AuthField[] = [
  {
    name: "email",
    label: "School email",
    check: (value) => {
      const email = value.trim();
      if (!email) return "Enter your school email address.";
      return SCHOOL_EMAIL.test(email) ? null : "Use your @dlsau.edu.ph email address.";
    },
  },
  {
    name: "studentNumber",
    label: "Student number",
    check: (value) => {
      const number = value.trim();
      if (!number) return "Enter your student number.";
      return /^\d{4,}$/.test(number) ? null : "Use digits only, at least four (e.g. 20231001).";
    },
  },
  {
    name: "displayName",
    label: "Username",
    check: (value) => {
      const name = value.trim();
      if (!name) return "Choose the username others will see.";
      return name.length <= 60 ? null : "Usernames are 60 characters or fewer.";
    },
  },
  {
    name: "password",
    label: "Password",
    check: (value) => {
      if (!value) return "Enter a password.";
      return value.length >= MIN_PASSWORD_LENGTH
        ? null
        : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    },
  },
  {
    name: "confirm",
    label: "Confirm password",
    check: (value, form) => {
      if (!value) return "Re-enter your password here.";
      const password = form.querySelector<HTMLInputElement>('input[name="password"]');
      return value === password?.value ? null : "Passwords do not match.";
    },
  },
];

/** Picks the boxes a server rejection talks about, so only those start flagged. */
function boxesForMessage(message: string): string[] {
  const text = message.toLowerCase();
  const names: string[] = [];
  if (text.includes("email")) names.push("email");
  if (text.includes("student number")) names.push("studentNumber");
  if (text.includes("username")) names.push("displayName");
  if (text.includes("password")) names.push(text.includes("match") ? "confirm" : "password");
  return names;
}

export function SignupForm({ error }: { error?: string }) {
  // A rejection redirects back with ?error=: the page keeps the inline notice
  // above the form, and the boxes it talks about start flagged.
  const { formRef, messages, isInvalid, guard, handleChange } = useAuthForm(
    FIELDS,
    error ? boxesForMessage(error) : [],
  );

  /** Shared plumbing for every box: red class plus the aria wiring. */
  function fieldProps(name: string) {
    return {
      className: `${inputClass}${isInvalid(name) ? " field-invalid" : ""}`,
      "aria-invalid": isInvalid(name) || undefined,
      "aria-describedby": messages[name] ? `${name}-error` : undefined,
    };
  }

  /** Also gates the terms dialog: it never opens over unfinished boxes. */
  function validate(): boolean {
    return guard();
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!validate()) event.preventDefault();
  }

  return (
    <form
      ref={formRef}
      action="/api/auth/signup"
      method="post"
      noValidate
      onSubmit={onSubmit}
      onChange={handleChange}
      className="mt-6 space-y-3"
    >
      <div>
        <label htmlFor="email" className={labelClass}>School email</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="name@dlsau.edu.ph" required {...fieldProps("email")} />
        {messages.email && <FieldError id="email-error" message={messages.email} />}
      </div>
      <div>
        <label htmlFor="studentNumber" className={labelClass}>Student number</label>
        <input id="studentNumber" name="studentNumber" inputMode="numeric" autoComplete="username" placeholder="20231001" required {...fieldProps("studentNumber")} />
        {messages.studentNumber && <FieldError id="studentNumber-error" message={messages.studentNumber} />}
      </div>
      <div>
        <label htmlFor="displayName" className={labelClass}>Username</label>
        <input id="displayName" name="displayName" maxLength={60} autoComplete="nickname" placeholder="How others will see you" required {...fieldProps("displayName")} />
        {messages.displayName && <FieldError id="displayName-error" message={messages.displayName} />}
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" required minLength={8} {...fieldProps("password")} />
        {messages.password && <FieldError id="password-error" message={messages.password} />}
      </div>
      <div>
        <label htmlFor="confirm" className={labelClass}>Confirm password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} {...fieldProps("confirm")} />
        {messages.confirm && <FieldError id="confirm-error" message={messages.confirm} />}
      </div>
      <TermsAgreement label="Create account" onValidate={validate} />
    </form>
  );
}
