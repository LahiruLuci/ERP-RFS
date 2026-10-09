"use server";

import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type ResetPasswordState = {
  error?: string;
  message?: string;
};

const passwordsRequiredMessage = "Enter and confirm your new password.";
const passwordsMismatchMessage = "Passwords do not match.";
const passwordTooShortMessage = "Use a password with at least 8 characters.";
const authNotConfiguredMessage = "Supabase authentication is not configured yet.";
const updateFailedMessage = "Unable to update your password. Please try again.";
const successRedirect = "/login?message=password_updated";

function readPasswords(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  return { password, confirmPassword };
}

export async function resetPassword(
  _previousState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const { password, confirmPassword } = readPasswords(formData);

  if (!password || !confirmPassword) {
    return {
      error: passwordsRequiredMessage,
    };
  }

  if (password !== confirmPassword) {
    return {
      error: passwordsMismatchMessage,
    };
  }

  if (password.length < 8) {
    return {
      error: passwordTooShortMessage,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      error: authNotConfiguredMessage,
    };
  }

  const supabase = await createClient();

  try {
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[reset-password-debug] updateUser failed:", {
          name: error.name,
          message: error.message,
          status: error.status,
          code: error.code,
        });
      }

      return {
        error: updateFailedMessage,
      };
    }

    await supabase.auth.signOut();
  } catch (updateException) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[reset-password-debug] updateUser threw:", updateException);
    }

    try {
      await supabase.auth.signOut();
    } catch {
      // best-effort sign out after failure
    }

    return {
      error: updateFailedMessage,
    };
  }

  redirect(successRedirect);
}
