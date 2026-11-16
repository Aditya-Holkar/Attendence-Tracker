/**
 * Reads the Supabase connection settings. Returns null when the deployment has
 * not been configured yet, so the app can show a setup page instead of a 500.
 */
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}
