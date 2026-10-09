"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createUserSession } from "@/lib/supabase/session";

export type LoginState = {
  error?: string;
  message?: string;
};

const invalidLoginMessage = "Email or password is incorrect.";
const authNotConfiguredMessage = "Supabase authentication is not configured yet.";
const sessionCreationFailedMessage = "Unable to start your session. Please try again.";

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const { email, password } = readCredentials(formData);

  console.log("[login-debug] credential-shape:", {
    emailLength: email.length,
    emailTrimmed: email === email.trim(),
    passwordLength: password.length,
    passwordTrimmed: password === password.trim(),
    passwordLeadingWhitespace: /^\s/.test(password),
    passwordTrailingWhitespace: /\s$/.test(password),
  });

  if (!email || !password) {
    return {
      error: "Enter your email and password to continue.",
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      error: authNotConfiguredMessage,
    };
  }

  console.log("[login-debug] Supabase project:", process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, ""));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const isInvalidCredentials = error.code === "invalid_credentials";

    if (process.env.NODE_ENV !== "production") {
      console.log("[login-debug] Supabase auth failed:", {
        name: error.name,
        message: error.message,
        status: error.status,
        code: error.code,
        emailLength: email.length,
        passwordLength: password.length,
      });
    }

    return {
      error: isInvalidCredentials
        ? invalidLoginMessage
        : "Unable to sign in right now. Please try again.",
    };
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[login-debug] Supabase authentication SUCCESS");
  }

  let rawToken: string | null = null;

  try {
    rawToken = await createUserSession(supabase);
  } catch {
    await supabase.auth.signOut();
    return {
      error: sessionCreationFailedMessage,
    };
  }

  if (!rawToken) {
    await supabase.auth.signOut();
    return {
      error: sessionCreationFailedMessage,
    };
  }

  const cookieStore = await cookies();
  cookieStore.set("erp_session_token", rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/dashboard");
}

export async function signUp(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return {
      error: "Enter an email and password to create an account.",
    };
  }

  if (password.length < 6) {
    return {
      error: "Use a password with at least 6 characters.",
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      error: authNotConfiguredMessage,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return {
      error: "Unable to create an account with those details.",
    };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return {
    message:
      "Account created. Check your email to confirm the account, then sign in.",
  };
}

export async function logout() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/login");
}

