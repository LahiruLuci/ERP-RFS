import Image from "next/image";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  await connection();

  const isConfigured = isSupabaseConfigured();

  if (isConfigured) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();

    if (data?.claims) {
      redirect("/dashboard");
    }
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
            Access your business operations workspace
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
            Access is limited to authorized company users. Sign in with your
            account or create one if this is your first time here.
          </p>
        </section>

        <section
          aria-labelledby="login-heading"
          className="app-surface w-full rounded-lg p-6 sm:p-8"
        >
          <div className="mb-8">
            <h2
              className="text-2xl font-bold tracking-tight text-[var(--text-primary)]"
              id="login-heading"
            >
              Welcome back
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              Sign in or create an account to open the dashboard.
            </p>
          </div>

          <LoginForm isConfigured={isConfigured} />
        </section>
      </div>
    </main>
  );
}


