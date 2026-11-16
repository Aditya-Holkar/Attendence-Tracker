import ClockPanel from "@/components/clock-panel";
import { PageHeader, Stat } from "@/components/ui";
import { getOrg, requireProfile } from "@/lib/auth";
import { formatHM, shiftDate, todayInTz } from "@/lib/time";

export default async function EmployeeDashboard() {
  const { supabase, profile } = await requireProfile();
  const org = await getOrg(supabase);
  const today = todayInTz(org.timezone);

  const [{ data: schedule }, { data: sessions }, { data: holiday }] = await Promise.all([
    profile.schedule_id
      ? supabase.from("work_schedules").select("expected_minutes").eq("id", profile.schedule_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("attendance_sessions").select("work_date, net_seconds")
      .eq("employee_id", profile.id).gte("work_date", `${today.slice(0, 7)}-01`),
    supabase.from("holidays").select("name").eq("holiday_date", today).maybeSingle(),
  ]);

  const weekStart = shiftDate(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  const sum = (from: string) => (sessions ?? []).filter((s) => s.work_date >= from).reduce((t, s) => t + (s.net_seconds ?? 0), 0);

  return (
    <>
      <PageHeader title={`Hello, ${profile.full_name.split(" ")[0] || "there"}`}
        sub={holiday ? `Today is a holiday: ${holiday.name}` : "Your attendance for today"} />
      <ClockPanel userId={profile.id} timezone={org.timezone} expectedMinutes={schedule?.expected_minutes ?? 480} />
      <div className="mt-4 grid grid-cols-2 gap-4">
        <Stat label="This week" value={formatHM(sum(weekStart))} hint="Completed days" />
        <Stat label="This month" value={formatHM(sum(`${today.slice(0, 7)}-01`))} hint="Completed days" />
      </div>
    </>
  );
}
