import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/env";
import type { OrgSettings, Profile, Role } from "@/types";

const FALLBACK_ORG: OrgSettings = {
  name: "Company",
  timezone: "Asia/Kolkata",
  max_break_minutes: 60,
  overtime_after_minutes: 480,
};

/**
 * One auth + profile + settings read per server render.
 *
 * React's cache dedupes calls made by the layout sidebar and the page, so a
 * navigation does not pay for the same queries twice. `getClaims()` verifies
 * the JWT locally (the project uses asymmetric signing keys); `getUser()`
 * would call the Auth server on every single request.
 */
const loadViewer = cache(async () => {
  if (!supabaseConfig()) redirect("/setup");

  const supabase = await createClient();
  const result = await supabase.auth.getClaims().catch(() => null);

  // `getClaims` verifies locally with the cached JWKS. If fetching the keys
  // itself failed (network), fall back to the Auth server once rather than
  // breaking the page.
  let userId: string | undefined;
  if (result) {
    userId = result.error ? undefined : result.data?.claims?.sub;
  } else {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id;
  }
  if (!userId) redirect("/login");

  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("organization_settings").select("*").eq("id", 1).single(),
  ]);

  if (!profile || !profile.is_active) redirect("/login?error=inactive");

  return {
    supabase,
    profile: profile as Profile,
    org: (org as OrgSettings | null) ?? FALLBACK_ORG,
  };
});

export async function requireProfile(roles?: Role[]) {
  const viewer = await loadViewer();
  if (roles && !roles.includes(viewer.profile.role)) {
    redirect(viewer.profile.role === "employee" ? "/employee/dashboard" : "/admin/dashboard");
  }
  return viewer;
}

/** Organisation settings, shared with the viewer load above. */
export async function getOrg() {
  return (await loadViewer()).org;
}
