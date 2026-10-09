"use client";

import { useActionState } from "react";

import { resetPassword, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    resetPassword,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label
          className="text-sm font-semibold text-[var(--text-primary)]"
          htmlFor="password"
        >
          New Password
        </label>
        <input
          autoComplete="new-password"
          className="field-control h-12 rounded-md px-4 text-base transition"
          disabled={isPending}
          id="password"
          minLength={8}
          name="password"
          placeholder="Enter a new password"
          required
          type="password"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label
          className="text-sm font-semibold text-[var(--text-primary)]"
          htmlFor="confirmPassword"
        >
          Confirm New Password
        </label>
        <input
          autoComplete="new-password"
          className="field-control h-12 rounded-md px-4 text-base transition"
          disabled={isPending}
          id="confirmPassword"
          minLength={8}
          name="confirmPassword"
          placeholder="Re-enter your new password"
          required
          type="password"
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
        type="submit"
      >
        {isPending ? "Updating password..." : "Update Password"}
      </button>

      <p className="text-center text-sm text-[var(--text-secondary)]">
        <a
          className="app-focus font-semibold text-[var(--brand-primary)] underline"
          href="/forgot-password"
        >
          Request a new reset link
        </a>
      </p>
    </form>
  );
}
