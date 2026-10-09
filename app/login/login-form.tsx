"use client";

import { useActionState, useState } from "react";

import { login, signUp, type LoginState } from "./actions";

const initialState: LoginState = {};
type AuthMode = "login" | "signup";

type LoginFormProps = {
  isConfigured: boolean;
  initialMessage?: string;
  initialError?: string;
};

export function LoginForm({
  isConfigured,
  initialMessage,
  initialError,
}: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginState, loginAction, isLoginPending] = useActionState(
    login,
    { ...initialState, message: initialMessage, error: initialError },
  );
  const [signUpState, signUpAction, isSignUpPending] = useActionState(
    signUp,
    initialState,
  );
  const state = mode === "login" ? loginState : signUpState;
  const isPending = isLoginPending || isSignUpPending;
  const isDisabled = isPending || !isConfigured;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-1">
        <button
          className={`app-focus min-h-10 rounded-[5px] px-3 text-sm font-bold transition ${
            mode === "login"
              ? "bg-white text-[var(--brand-primary)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          disabled={isPending}
          onClick={() => setMode("login")}
          type="button"
        >
          Sign in
        </button>
        <button
          className={`app-focus min-h-10 rounded-[5px] px-3 text-sm font-bold transition ${
            mode === "signup"
              ? "bg-white text-[var(--brand-primary)] shadow-sm"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          disabled={isPending}
          onClick={() => setMode("signup")}
          type="button"
        >
          Sign up
        </button>
      </div>

      <form
        action={mode === "login" ? loginAction : signUpAction}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-[var(--text-primary)]" htmlFor="email">
            Email
          </label>
          <input
            autoComplete="email"
            className="field-control h-12 rounded-md px-4 text-base transition"
            disabled={isDisabled}
            id="email"
            name="email"
            placeholder="name@company.com"
            required
            type="email"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-semibold text-[var(--text-primary)]"
            htmlFor="password"
          >
            Password
          </label>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="field-control h-12 rounded-md px-4 text-base transition"
            disabled={isDisabled}
            id="password"
            minLength={mode === "signup" ? 6 : undefined}
            name="password"
            required
            type="password"
          />
          {mode === "signup" ? (
            <p className="text-xs leading-5 text-[var(--text-secondary)]">
              Use at least 6 characters.
            </p>
          ) : (
            <p className="text-xs leading-5">
              <a
                className="app-focus font-semibold text-[var(--brand-primary)] underline"
                href="/forgot-password"
              >
                Forgot password?
              </a>
            </p>
          )}
        </div>

        {!isConfigured ? (
          <p
            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
            role="status"
          >
            Supabase authentication needs environment variables before sign-in is
            available.
          </p>
        ) : null}

        {state.error ? (
          <p
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        {state.message ? (
          <p
            className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
            role="status"
          >
            {state.message}
          </p>
        ) : null}

        <button
          className="app-focus btn-primary flex h-12 items-center justify-center rounded-md px-4 text-base font-bold transition disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isDisabled}
          type="submit"
        >
          {isPending
            ? mode === "login"
              ? "Signing in..."
              : "Creating account..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
