import Image from "next/image";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  await connection();

  const isConfigured = isSupabaseConfigured();

  if (!isConfigured) {
    redirect("/forgot-password?error=auth_not_configured");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/forgot-password?error=invalid_link");
  }

  return (
    <main className="app-bg flex min-h-dvh px-4 py-6 text-[var(--text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col justify-center gap-8 lg:grid lg:grid-cols-[1fr_440px] lg:items-center lg:gap-16">
        <section className="max-w-2xl">
          <div className="mb-6 flex items-center gap-3">
            <Image
              alt="Royal Force Security Services"
              className="size-14 rounded-lg object-contain"
              height={56}
              priority
              src="/royal-force-logo.png"
              width={56}
            />
            <div>
              <p className="text-lg font-bold leading-tight text-[var(--brand-primary)]">
                Royal Force
              </p>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--brand-accent)]">
                Security Services
              </p>
            </div>
          </div>
          <p className="brand-kicker mb-4">
            Internal Management System
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-5xl">
            Set a new password
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
            Create a strong password you can remember. We recommend using a
            combination of letters, numbers, and symbols.
          </p>
        </section>

        <section
          aria-labelledby="reset-password-heading"
          className="app-surface w-full rounded-lg p-6 sm:p-8"
        >
          <div className="mb-8">
            <h2
              className="text-2xl font-bold tracking-tight text-[var(--text-primary)]"
              id="reset-password-heading"
            >
              Update password
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Enter a new password for your account.
            </p>
          </div>

          <ResetPasswordForm />
        </section>
      </div>
    </main>
  );
}
