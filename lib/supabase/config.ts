function readSupabaseConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function isSupabaseConfigured() {
  const { supabaseUrl, supabasePublishableKey } = readSupabaseConfig();

  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function getSupabaseConfig() {
  const { supabaseUrl, supabasePublishableKey } = readSupabaseConfig();

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
  };
}
