import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthArt } from "@/components/linc/auth-art";
import { RecoveryConfirm } from "@/components/linc/recovery-confirm";
import { ThemeToggle } from "@/components/linc/theme-toggle";
import { RECOVERY_COOKIE } from "@/lib/auth/password";

export const metadata: Metadata = { title: "Save your recovery code · LINC" };
export const dynamic = "force-dynamic";

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const code = (await cookies()).get(RECOVERY_COOKIE)?.value;
  if (!code) redirect("/");
  const { reset } = await searchParams;

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-2">
      <AuthArt
        title="Keep this code safe."
        caption="It is the only way to reset your password if you forget it."
      />
      <div className="relative flex flex-col items-center justify-center px-6 py-10">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-[360px]">
          <h1 className="text-[26px] font-black tracking-[-0.04em] text-ink">
            {reset ? "Password updated" : "Account created"}
          </h1>
          <p className="mt-1 text-[13px] text-neutral-500">
            {reset
              ? "Your old recovery code no longer works. Save this new one."
              : "Save your recovery code now."}{" "}
            It is shown only once and cannot be viewed again.
          </p>

          <p
            className="mt-6 select-all rounded-xl border border-line bg-white px-3.5 py-4 text-center font-mono text-[20px] font-bold tracking-wider text-ink"
            aria-label="Recovery code"
          >
            {code}
          </p>
          <p className="mt-2 text-[12px] text-neutral-500">
            Write it down or store it in a password manager. Anyone with this code and your email or
            student number can reset your password.
          </p>

          <RecoveryConfirm to={reset ? "/login" : "/"} />
        </div>
      </div>
    </div>
  );
}
