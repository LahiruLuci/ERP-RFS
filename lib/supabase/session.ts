import { createClient } from "./server";

export type UserSession = {
  id: string;
  user_id: string;
  last_activity_at: string;
  created_at: string;
  expires_at: string;
};

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function createUserSession(
  supabase: SupabaseServerClient,
): Promise<string> {
  const { data, error } = await supabase.rpc("create_user_session");
  const hasSessionToken = typeof data === "string" && data.length > 0;

  if (process.env.NODE_ENV !== "production") {
    console.log("[session-debug] create_user_session result:", {
      hasSessionToken,
    });

    if (error) {
      console.log("[session-debug] create_user_session error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }
  }

  if (error || !data) {
    throw new Error(`Failed to create session: ${error?.message ?? "unknown error"}`);
  }

  return data as string;
}

export async function getSessionByToken(
  supabase: SupabaseServerClient,
  sessionToken: string,
): Promise<UserSession | null> {
  const { data, error } = await supabase.rpc("get_session_by_token", {
    p_session_token: sessionToken,
  });

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0] as UserSession;
}

export async function updateSessionActivity(
  supabase: SupabaseServerClient,
  sessionToken: string,
): Promise<void> {
  await supabase.rpc("update_session_activity_by_token", {
    p_session_token: sessionToken,
  });
}

export async function invalidateSession(
  supabase: SupabaseServerClient,
  sessionToken: string,
): Promise<void> {
  const { error } = await supabase.rpc("invalidate_session_by_token", {
    p_session_token: sessionToken,
  });

  if (error) {
    throw new Error(`Failed to invalidate session: ${error.message}`);
  }
}
