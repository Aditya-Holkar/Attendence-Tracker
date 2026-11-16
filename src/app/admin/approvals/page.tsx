import { reviewAdjustment, reviewLeave, reviewResume } from "@/app/actions";
import { btnCls, btnGhost, Card, PageHeader } from "@/components/ui";
import { getOrg, requireProfile } from "@/lib/auth";
import { formatDay, formatTime } from "@/lib/time";

export default async function Approvals() {
  const { supabase, profile } = await requireProfile(["admin", "manager"]);
  const org = await getOrg(supabase);
  const [{ data: adj }, { data: leave }, { data: resumes }] = await Promise.all([
    supabase.from("attendance_adjustments")
      .select("*, profiles!attendance_adjustments_employee_id_fkey(full_name)").eq("status", "pending").order("created_at"),
    supabase.from("leave_requests")
      .select("*, profiles!leave_requests_employee_id_fkey(full_name)").eq("status", "pending").order("created_at"),
    supabase.from("resume_requests")
      .select("*, profiles!resume_requests_employee_id_fkey(full_name)").eq("status", "pending").order("created_at"),
  ]);
  const adjustments = ((adj ?? []) as any[]).filter((r) => r.employee_id !== profile.id);
  const leaves = ((leave ?? []) as any[]).filter((r) => r.employee_id !== profile.id);
  const resumeList = ((resumes ?? []) as any[]).filter((r) => r.employee_id !== profile.id);

  return (
    <>
      <PageHeader title="Approvals" sub="You can’t review your own requests." />
      <Card title={`Attendance corrections (${adjustments.length})`} className="mb-4">
        {adjustments.length === 0 ? <p className="text-sm text-muted">Nothing waiting.</p> : (
          <ul className="divide-y divide-line">
            {adjustments.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{r.profiles?.full_name} · {formatDay(r.work_date)}</p>
                  <p className="tnum text-muted">{formatTime(r.requested_clock_in, org.timezone)} to {formatTime(r.requested_clock_out, org.timezone)}</p>
                  <p className="mt-1">{r.reason}</p>
                </div>
                <form action={reviewAdjustment} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" placeholder="Note (optional)" className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm placeholder:text-muted" />
                  <button name="decision" value="approve" className={btnCls}>Approve</button>
                  <button name="decision" value="reject" className={btnGhost}>Reject</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={`Resume requests (${resumeList.length})`} className="mb-4">
        {resumeList.length === 0 ? <p className="text-sm text-muted">Nothing waiting.</p> : (
          <ul className="divide-y divide-line">
            {resumeList.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{r.profiles?.full_name} · {formatDay(r.work_date)}</p>
                  <p className="text-muted">
                    Clocked out by mistake at {formatTime(r.created_at, org.timezone)}
                    {r.reason ? ` · ${r.reason}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Approving reopens the day; the timer continues from the original clock-in time.
                  </p>
                </div>
                <form action={reviewResume} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <input name="note" placeholder="Note (optional)" className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm placeholder:text-muted" />
                  <button name="decision" value="approve" className={btnCls}>Approve</button>
                  <button name="decision" value="reject" className={btnGhost}>Reject</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Leave requests (${leaves.length})`}>
        {leaves.length === 0 ? <p className="text-sm text-muted">Nothing waiting.</p> : (
          <ul className="divide-y divide-line">
            {leaves.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{r.profiles?.full_name} · <span className="capitalize">{r.leave_type}</span></p>
                  <p className="text-muted">{r.start_date} to {r.end_date}{r.reason ? ` · ${r.reason}` : ""}</p>
                </div>
                <form action={reviewLeave} className="flex gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <button name="decision" value="approve" className={btnCls}>Approve</button>
                  <button name="decision" value="reject" className={btnGhost}>Reject</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
