import Image from "next/image";
import { connection } from "next/server";

import { ForgotPasswordForm } from "./forgot-password-form";

type ForgotPasswordPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

function getInvalidLinkMessage(error?: string) {
  if (error === "invalid_link" || error === "access_denied" || error === "otp_expired") {
    return "This password reset link is invalid or has expired. Please request a new one.";
  }

  return undefined;
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  await connection();

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialError = getInvalidLinkMessage(resolvedSearchParams?.error);

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
            Reset your password
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
            Enter the email address associated with your account and we will
            send you a link to reset your password.
          </p>
        </section>

        <section
          aria-labelledby="forgot-password-heading"
          className="app-surface w-full rounded-lg p-6 sm:p-8"
        >
          <div className="mb-8">
            <h2
              className="text-2xl font-bold tracking-tight text-[var(--text-primary)]"
              id="forgot-password-heading"
            >
              Forgot password?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              We will send you a secure reset link.
            </p>
          </div>

          <ForgotPasswordForm initialError={initialError} />
        </section>
      </div>
    </main>
  );
}
