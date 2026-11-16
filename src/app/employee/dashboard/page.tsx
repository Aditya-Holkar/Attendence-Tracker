import ClockPanel from "@/components/clock-panel";
import { requestResume, sendDailyUpdate } from "@/app/actions";
import { btnCls, Card, inputCls, PageHeader, Stat } from "@/components/ui";
import { getOrg, requireProfile } from "@/lib/auth";
import { formatHM, formatTime, shiftDate, todayInTz } from "@/lib/time";

export default async function EmployeeDashboard() {
  const { supabase, profile } = await requireProfile();
  const org = await getOrg();
  const today = todayInTz(org.timezone);

  const [{ data: schedule }, { data: sessions }, { data: holiday }, { data: resume }, { data: updates }] = await Promise.all([
    profile.schedule_id
      ? supabase.from("work_schedules").select("expected_minutes").eq("id", profile.schedule_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("attendance_sessions").select("id, work_date, status, net_seconds")
      .eq("employee_id", profile.id).gte("work_date", `${today.slice(0, 7)}-01`),
    supabase.from("holidays").select("name").eq("holiday_date", today).maybeSingle(),
    supabase.from("resume_requests").select("*")
      .eq("employee_id", profile.id).eq("work_date", today)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("daily_updates").select("id, message, created_at")
      .eq("employee_id", profile.id).order("created_at", { ascending: false }).limit(5),
  ]);

  const todaySession = (sessions ?? []).find((s) => s.work_date === today);
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

      {todaySession?.status === "completed" && (
        <Card title="Clocked out by mistake?" className="mt-4">
          {resume?.status === "pending" ? (
            <p className="text-sm text-muted">
              Request sent at {formatTime(resume.created_at, org.timezone)}. Waiting for an admin or manager to approve it.
            </p>
          ) : (
            <form action={requestResume} className="space-y-3">
              <input type="hidden" name="session_id" value={todaySession.id} />
              <p className="text-sm text-muted">
                Send a request to reopen today. Once it is approved, the timer continues from your original
                clock-in time.
              </p>
              <textarea name="reason" rows={2} placeholder="What happened? (optional)" className={inputCls} />
              <button className={btnCls}>Send resume request</button>
            </form>
          )}
          {resume?.status === "rejected" && (
            <p className="mt-2 text-sm text-alert">
              Your last request was rejected{resume.review_note ? `: ${resume.review_note}` : "."}
            </p>
          )}
        </Card>
      )}

      <Card title="What I did today" className="mt-4">
        <form action={sendDailyUpdate} className="space-y-3">
          <textarea name="message" required maxLength={2000} rows={3}
            placeholder="Share a quick summary with your admin…" className={inputCls} />
          <button className={btnCls}>Send to admin</button>
        </form>
        {(updates ?? []).length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {(updates ?? []).map((u) => (
              <li key={u.id} className="rounded-md border border-line px-3 py-2">
                <p className="whitespace-pre-line">{u.message}</p>
                <p className="mt-1 text-xs text-muted">{formatTime(u.created_at, org.timezone)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
