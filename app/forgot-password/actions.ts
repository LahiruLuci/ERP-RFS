"use server";

import { headers } from "next/headers";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordState = {
  error?: string;
  message?: string;
};

const emailRequiredMessage = "Enter your email to receive a reset link.";
const authNotConfiguredMessage = "Supabase authentication is not configured yet.";
const genericSuccessMessage =
  "If an account exists for this email, a password reset link has been sent.";

async function getRedirectBase() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const xForwardedProto = headersList.get("x-forwarded-proto");
  const protocol = xForwardedProto ? xForwardedProto.split(",")[0]?.trim() : "http";

  return `${protocol}://${host}`;
}

export async function forgotPassword(
  _previousState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return {
      error: emailRequiredMessage,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      error: authNotConfiguredMessage,
    };
  }

  const supabase = await createClient();
  const redirectTo = `${await getRedirectBase()}/auth/callback?next=/reset-password`;

  if (process.env.NODE_ENV !== "production") {
    console.log("[recovery-debug] resetPasswordForEmail redirectTo:", redirectTo);
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[forgot-password-debug] Supabase auth failed:", {
        name: error.name,
        message: error.message,
        status: error.status,
        code: error.code,
      });
    }

    return {
      error: "Unable to send a reset link right now. Please try again.",
    };
  }

  return {
    message: genericSuccessMessage,
  };
}
