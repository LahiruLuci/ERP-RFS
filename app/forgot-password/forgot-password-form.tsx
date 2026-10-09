"use client";

import { useActionState, useState } from "react";

import { forgotPassword, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

type ForgotPasswordFormProps = {
  initialError?: string;
};

export function ForgotPasswordForm({ initialError }: ForgotPasswordFormProps) {
  const [state, formAction, isPending] = useActionState(
    forgotPassword,
    { ...initialState, error: initialError },
  );
  const [emailSent, setEmailSent] = useState(false);

  if (emailSent && state.message) {
    return (
      <div className="flex flex-col gap-4">
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          role="status"
        >
          {state.message}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          Didn&apos;t receive the email? Check your spam folder or{" "}
          <button
            className="app-focus font-semibold text-[var(--brand-primary)] underline"
            onClick={() => setEmailSent(false)}
            type="button"
          >
            try again
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label
          className="text-sm font-semibold text-[var(--text-primary)]"
          htmlFor="email"
        >
          Email
        </label>
        <input
          autoComplete="email"
          className="field-control h-12 rounded-md px-4 text-base transition"
          disabled={isPending}
          id="email"
          name="email"
          placeholder="name@company.com"
          required
          type="email"
        />
      </div>

      {state.error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <button
        className="app-focus btn-primary flex h-12 items-center justify-center rounded-md px-4 text-base font-bold transition disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isPending}
        onClick={() => setEmailSent(true)}
        type="submit"
      >
        {isPending ? "Sending reset link..." : "Send reset link"}
      </button>

      <p className="text-center text-sm text-[var(--text-secondary)]">
        <a
          className="app-focus font-semibold text-[var(--brand-primary)] underline"
          href="/login"
        >
          Back to sign in
        </a>
      </p>
    </form>
  );
}
