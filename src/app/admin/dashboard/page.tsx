import { Badge, Card, PageHeader, Stat, statusBadge, Table } from "@/components/ui";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TrendChart } from "@/components/trend-chart";
import { getOrg, requireProfile } from "@/lib/auth";
import { isLate, summarize, type AttEvent } from "@/lib/attendance/calculations";
import { formatClock, formatDay, formatTime, shiftDate, todayInTz } from "@/lib/time";

export default async function AdminDashboard() {
  const { supabase } = await requireProfile(["admin", "manager"]);
  const org = await getOrg(supabase);
  const today = todayInTz(org.timezone);
  const since = shiftDate(today, -6);

  const [{ data: people }, { data: sessions }, { count: pendingAdj }, { count: pendingLeave }, { count: pendingResume }, { data: flagged }, { data: updates }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, schedule:work_schedules(start_time, grace_minutes)").eq("is_active", true),
    supabase.from("attendance_sessions").select("*").gte("work_date", since),
    supabase.from("attendance_adjustments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("resume_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("attendance_events").select("id, event_type, flag, received_at, profiles!attendance_events_employee_id_fkey(full_name)")
      .not("flag", "is", null).order("received_at", { ascending: false }).limit(8),
    supabase.from("daily_updates").select("id, message, created_at, profiles!daily_updates_employee_id_fkey(full_name)")
      .eq("work_date", today).order("created_at", { ascending: false }).limit(12),
  ]);

  const all = sessions ?? [];
  const todays = all.filter((s) => s.work_date === today);
  const ids = todays.map((s) => s.id);
  type EvRow = { id: string; session_id: string; event_type: AttEvent["event_type"]; occurred_at: string; voided?: boolean };
  let evs: EvRow[] = [];
  if (ids.length) {
    const withVoided = await supabase.from("attendance_events")
      .select("id, session_id, event_type, occurred_at, voided").in("session_id", ids);
    if (withVoided.error) {
      // 0002 migration not applied yet: read the old columns instead of blanking the table.
      const plain = await supabase.from("attendance_events")
        .select("id, session_id, event_type, occurred_at").in("session_id", ids);
      evs = (plain.data ?? []) as EvRow[];
    } else {
      evs = (withVoided.data ?? []) as EvRow[];
    }
  }

  const bySession = new Map<string, AttEvent[]>();
  for (const e of evs ?? []) bySession.set(e.session_id, [...(bySession.get(e.session_id) ?? []), e]);
  const people_ = (people ?? []) as any[];
  const rows = people_.map((p) => {
    const s = todays.find((x) => x.employee_id === p.id);
    const sum = s ? summarize(bySession.get(s.id) ?? []) : null;
    const work = s ? (s.status === "completed" ? s.net_seconds ?? 0 : sum?.workSeconds ?? 0) : 0;
    const brk = s ? (s.status === "completed" ? s.break_seconds : sum?.breakSeconds ?? s.break_seconds) : 0;
    const late = s && p.schedule ? isLate(s.clock_in_at, org.timezone, p.schedule.start_time, p.schedule.grace_minutes) : false;
    return { p, s, work, brk, late, overBreak: brk > org.max_break_minutes * 60 };
  });

  const count = (st: string) => todays.filter((s) => s.status === st).length;
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = shiftDate(since, i);
    return { day: formatDay(d), present: new Set(all.filter((s) => s.work_date === d).map((s) => s.employee_id)).size };
  });
  const missingOut = all.filter((s) => s.status !== "completed" && s.work_date < today);

  return (
    <>
      <RealtimeRefresh />
      <PageHeader title="Workforce overview" sub={`Today in ${org.timezone}. Updates live.`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Present" value={todays.length} hint={`of ${people_.length} active`} />
        <Stat label="Absent so far" value={Math.max(0, people_.length - todays.length)} />
        <Stat label="On break" value={count("on_break")} />
        <Stat label="Late" value={rows.filter((r) => r.late).length} />
        <Stat label="Pending approvals" value={(pendingAdj ?? 0) + (pendingLeave ?? 0) + (pendingResume ?? 0)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Live employee status" className="lg:col-span-2">
          <Table head={["Employee", "Status", "In", "Working", "Break"]} empty={rows.length ? undefined : "No active employees."}>
            {rows.map(({ p, s, work, brk, late, overBreak }) => (
              <tr key={p.id}>
                <td className="font-medium">{p.full_name || "Unnamed"}</td>
                <td>{statusBadge(s?.status ?? "not_started")} {late && <Badge tone="alert">Late</Badge>}</td>
                <td className="tnum">{s ? formatTime(s.clock_in_at, org.timezone) : "—"}</td>
                <td className="tnum">{s ? formatClock(work) : "—"}</td>
                <td className="tnum">{s ? formatClock(brk) : "—"} {overBreak && <Badge tone="pause">Over limit</Badge>}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Present, last 7 days"><TrendChart data={trend} /></Card>
      </div>

      <Card title="What the team did today" className="mt-4">
        {(updates ?? []).length === 0 ? (
          <p className="text-sm text-muted">No updates sent yet today.</p>
        ) : (
          <ul className="divide-y divide-line">
            {((updates ?? []) as any[]).map((u) => (
              <li key={u.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">{u.profiles?.full_name ?? "Employee"}</p>
                  <p className="text-xs text-muted">{formatTime(u.created_at, org.timezone)}</p>
                </div>
                <p className="mt-1 whitespace-pre-line">{u.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Exceptions" className="mt-4">
        {missingOut.length === 0 && !(flagged ?? []).length ? (
          <p className="text-sm text-muted">No missing clock-outs or suspicious timestamps.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {missingOut.map((s) => <li key={s.id}><Badge tone="alert">Missing clock-out</Badge> {formatDay(s.work_date)}, still {s.status.replace("_", " ")}</li>)}
            {((flagged ?? []) as any[]).map((e) => (
              <li key={e.id}><Badge tone="pause">{e.flag === "future_timestamp" ? "Device clock ahead" : "Out of sequence"}</Badge> {e.profiles?.full_name} {e.event_type.toLowerCase().replace("_", " ")}</li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
