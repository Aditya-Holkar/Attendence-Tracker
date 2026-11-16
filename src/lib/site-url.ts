/**
 * Canonical public URL for links we generate, such as auth confirmation emails.
 *
 * Set NEXT_PUBLIC_SITE_URL in the deployment (and in .env.local if you want
 * local sign-ups to send production links). Without it we fall back to the
 * browser's origin, which keeps preview deployments working on their own URL.
 */
export function siteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return typeof window === "undefined" ? "" : window.location.origin;
}
