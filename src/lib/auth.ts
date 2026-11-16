import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/env";
import type { OrgSettings, Profile, Role } from "@/types";

export async function requireProfile(roles?: Role[]) {
  if (!supabaseConfig()) redirect("/setup");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || !profile.is_active) redirect("/login?error=inactive");

  const p = profile as Profile;
  if (roles && !roles.includes(p.role)) {
    redirect(p.role === "employee" ? "/employee/dashboard" : "/admin/dashboard");
  }
  return { supabase, profile: p };
}

export async function getOrg(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("organization_settings").select("*").eq("id", 1).single();
  return (data ?? { name: "Company", timezone: "Asia/Kolkata", max_break_minutes: 60, overtime_after_minutes: 480 }) as OrgSettings;
}
