import { requestAdjustment } from "@/app/actions";
import { btnCls, Card, Field, inputCls, PageHeader, statusBadge, Table } from "@/components/ui";
import { getOrg, requireProfile } from "@/lib/auth";
import { formatDay, formatTime } from "@/lib/time";

export default async function Corrections() {
  const { supabase, profile } = await requireProfile();
  const org = await getOrg();
  const { data } = await supabase.from("attendance_adjustments").select("*")
    .eq("employee_id", profile.id).order("created_at", { ascending: false }).limit(30);

  return (
    <>
      <PageHeader title="Corrections" sub="Forgot to clock in or out? Ask for a fix. Your manager or an admin reviews it." />
      <Card title="New request" className="mb-4">
        <form action={requestAdjustment} className="grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="tz" value={org.timezone} />
          <Field label="Date"><input type="date" name="work_date" required className={inputCls} /></Field>
          <Field label="Clock in"><input type="time" name="clock_in" required className={inputCls} /></Field>
          <Field label="Clock out"><input type="time" name="clock_out" required className={inputCls} /></Field>
          <div className="sm:col-span-3"><Field label="Reason"><textarea name="reason" required rows={2} className={inputCls} /></Field></div>
          <div className="sm:col-span-3"><button className={btnCls}>Send request</button></div>
        </form>
        <p className="mt-3 text-xs text-muted">Times are in {org.timezone}. Approval replaces the clock in and out for that day.</p>
      </Card>
      <Card title="Your requests">
        <Table head={["Date", "In", "Out", "Reason", "Status"]} empty={data?.length ? undefined : "No requests yet."}>
          {(data ?? []).map((r) => (
            <tr key={r.id}>
              <td>{formatDay(r.work_date)}</td>
              <td className="tnum">{formatTime(r.requested_clock_in, org.timezone)}</td>
              <td className="tnum">{formatTime(r.requested_clock_out, org.timezone)}</td>
              <td className="max-w-xs truncate">{r.reason}</td>
              <td>{statusBadge(r.status)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
