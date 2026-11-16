import { Badge, btnGhost, Card, inputCls, PageHeader, statusBadge, Table } from "@/components/ui";
import { getOrg, requireProfile } from "@/lib/auth";
import { fetchDaily } from "@/lib/reports";
import { formatDay, formatHM, formatTime, shiftDate, todayInTz } from "@/lib/time";

export default async function AdminTimesheets({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; q?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireProfile(["admin", "manager"]);
  const org = await getOrg();
  const to = sp.to || todayInTz(org.timezone);
  const from = sp.from || shiftDate(to, -13);
  const rows = await fetchDaily(supabase, from, to, sp.q);
  const qs = new URLSearchParams({ type: "daily", from, to, ...(sp.q ? { q: sp.q } : {}) });

  return (
    <>
      <PageHeader title="Timesheets" sub="Daily attendance for the people you can see" />
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <input type="date" name="from" defaultValue={from} className={`${inputCls} w-auto`} aria-label="From" />
        <input type="date" name="to" defaultValue={to} className={`${inputCls} w-auto`} aria-label="To" />
        <input name="q" defaultValue={sp.q} placeholder="Search employee" className={`${inputCls} w-auto`} />
        <button className={btnGhost}>Apply</button>
        <a className={btnGhost} href={`/api/reports/export?${qs}`}>Export CSV</a>
      </form>
      <Card>
        <Table head={["Date", "Employee", "In", "Out", "Breaks", "Net", "Status"]} empty={rows.length ? undefined : "No attendance in this range."}>
          {rows.map((r) => (
            <tr key={`${r.employee_id}${r.work_date}`}>
              <td>{formatDay(r.work_date)}</td><td className="font-medium">{r.name}</td>
              <td className="tnum">{formatTime(r.clock_in_at, org.timezone)}</td>
              <td className="tnum">{formatTime(r.clock_out_at, org.timezone)}</td>
              <td className="tnum">{formatHM(r.break_seconds)}</td><td className="tnum">{formatHM(r.net_seconds)}</td>
              <td>{statusBadge(r.status)} {r.is_adjusted && <Badge tone="pause">Adjusted</Badge>}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
