import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/supabase/env";

export function createClient() {
  const env = supabaseConfig();
  if (!env) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then rebuild.",
    );
  }
  return createBrowserClient(env.url, env.key);
}
