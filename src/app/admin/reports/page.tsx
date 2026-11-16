import { btnGhost, Card, inputCls, PageHeader, Table } from "@/components/ui";
import { getOrg, requireProfile } from "@/lib/auth";
import { aggregate, fetchDaily } from "@/lib/reports";
import { formatHM, shiftDate, todayInTz } from "@/lib/time";

export default async function Reports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireProfile(["admin", "manager"]);
  const org = await getOrg();
  const to = sp.to || todayInTz(org.timezone);
  const from = sp.from || shiftDate(to, -29);
  const rows = aggregate(await fetchDaily(supabase, from, to), org.overtime_after_minutes);
  const qs = new URLSearchParams({ type: "summary", from, to });

  return (
    <>
      <PageHeader title="Reports" sub={`Overtime counts time beyond ${org.overtime_after_minutes / 60} hours a day. Completed days only.`} />
      <form className="mb-4 flex flex-wrap items-end gap-3">
        <input type="date" name="from" defaultValue={from} className={`${inputCls} w-auto`} aria-label="From" />
        <input type="date" name="to" defaultValue={to} className={`${inputCls} w-auto`} aria-label="To" />
        <button className={btnGhost}>Apply</button>
        <a className={btnGhost} href={`/api/reports/export?${qs}`}>Export CSV</a>
      </form>
      <Card>
        <Table head={["Employee", "Days", "Total net", "Avg per day", "Breaks", "Overtime"]} empty={rows.length ? undefined : "No completed days in this range."}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="font-medium">{r.name}</td><td className="tnum">{r.days}</td>
              <td className="tnum">{formatHM(r.net)}</td><td className="tnum">{formatHM(r.avgNet)}</td>
              <td className="tnum">{formatHM(r.breaks)}</td><td className="tnum">{formatHM(r.overtime)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
