"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const nul = (f: FormData, k: string) => str(f, k) || null;
const fail = (msg: string) => { throw new Error(msg); };

export async function signOut() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect("/login");
}

export async function requestAdjustment(f: FormData) {
  const { supabase, profile } = await requireProfile();
  const date = str(f, "work_date");
  const tz = str(f, "tz") || "Asia/Kolkata";
  // Convert wall-clock times in the ORGANISATION timezone to UTC instants.
  const toUtc = (time: string) => {
    const guess = new Date(`${date}T${time}:00Z`);
    const inTz = new Date(guess.toLocaleString("en-US", { timeZone: tz }));
    const asUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
    return new Date(guess.getTime() + (asUtc.getTime() - inTz.getTime())).toISOString();
  };
  const { error } = await supabase.from("attendance_adjustments").insert({
    employee_id: profile.id, work_date: date,
    requested_clock_in: toUtc(str(f, "clock_in")), requested_clock_out: toUtc(str(f, "clock_out")),
    reason: str(f, "reason"),
  });
  if (error) fail(error.message);
  revalidatePath("/employee/corrections");
}

export async function reviewAdjustment(f: FormData) {
  const { supabase } = await requireProfile(["admin", "manager"]);
  const { error } = await supabase.rpc("review_adjustment", {
    p_id: str(f, "id"), p_approve: str(f, "decision") === "approve", p_note: nul(f, "note"),
  });
  if (error) fail(error.message);
  revalidatePath("/admin/approvals");
}

export async function requestLeave(f: FormData) {
  const { supabase, profile } = await requireProfile();
  const { error } = await supabase.from("leave_requests").insert({
    employee_id: profile.id, start_date: str(f, "start_date"), end_date: str(f, "end_date"),
    leave_type: str(f, "leave_type") || "casual", reason: nul(f, "reason"),
  });
  if (error) fail(error.message);
  revalidatePath("/employee/leave");
}

export async function reviewLeave(f: FormData) {
  const { supabase, profile } = await requireProfile(["admin", "manager"]);
  const { error } = await supabase.from("leave_requests").update({
    status: str(f, "decision") === "approve" ? "approved" : "rejected",
    reviewed_by: profile.id, reviewed_at: new Date().toISOString(),
  }).eq("id", str(f, "id")).eq("status", "pending");
  if (error) fail(error.message);
  revalidatePath("/admin/approvals");
}

export async function updateEmployee(f: FormData) {
  const { supabase } = await requireProfile(["admin"]);
  const { error } = await supabase.from("profiles").update({
    full_name: str(f, "full_name"), role: str(f, "role"), is_active: f.get("is_active") === "on",
    manager_id: nul(f, "manager_id"), department_id: nul(f, "department_id"), schedule_id: nul(f, "schedule_id"),
  }).eq("id", str(f, "id"));
  if (error) fail(error.message);
  revalidatePath("/admin/employees");
}

export async function updateOrgSettings(f: FormData) {
  const { supabase } = await requireProfile(["admin"]);
  const { error } = await supabase.from("organization_settings").update({
    name: str(f, "name"), timezone: str(f, "timezone"),
    max_break_minutes: Number(str(f, "max_break_minutes")), overtime_after_minutes: Number(str(f, "overtime_after_minutes")),
  }).eq("id", 1);
  if (error) fail(error.message);
  revalidatePath("/admin/settings");
}

export async function createSchedule(f: FormData) {
  const { supabase } = await requireProfile(["admin"]);
  const { error } = await supabase.from("work_schedules").insert({
    name: str(f, "name"), start_time: str(f, "start_time"), end_time: str(f, "end_time"),
    grace_minutes: Number(str(f, "grace_minutes")), expected_minutes: Number(str(f, "expected_minutes")),
  });
  if (error) fail(error.message);
  revalidatePath("/admin/settings");
}

export async function createDepartment(f: FormData) {
  const { supabase } = await requireProfile(["admin"]);
  const { error } = await supabase.from("departments").insert({ name: str(f, "name") });
  if (error) fail(error.message);
  revalidatePath("/admin/settings");
}

export async function addHoliday(f: FormData) {
  const { supabase } = await requireProfile(["admin"]);
  const { error } = await supabase.from("holidays").insert({
    name: str(f, "name"), holiday_date: str(f, "holiday_date"), department_id: nul(f, "department_id"),
  });
  if (error) fail(error.message);
  revalidatePath("/admin/settings");
}
