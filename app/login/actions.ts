"use server";

import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
  message?: string;
};

const invalidLoginMessage = "Email or password is incorrect.";
const authNotConfiguredMessage = "Supabase authentication is not configured yet.";

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: invalidLoginMessage,
    };
  }

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
