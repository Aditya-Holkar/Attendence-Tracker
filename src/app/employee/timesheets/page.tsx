import { Badge, Card, PageHeader, statusBadge, Table } from "@/components/ui";
import { getOrg, requireProfile } from "@/lib/auth";
import { formatDay, formatHM, formatTime, shiftDate, todayInTz } from "@/lib/time";

export default async function Timesheets() {
  const { supabase, profile } = await requireProfile();
  const org = await getOrg();
  const from = shiftDate(todayInTz(org.timezone), -60);
  const { data } = await supabase.from("attendance_sessions").select("*")
    .eq("employee_id", profile.id).gte("work_date", from).order("work_date", { ascending: false });

  return (
    <>
      <PageHeader title="Timesheets" sub="Last 60 days" />
      <Card>
        <Table head={["Date", "In", "Out", "Breaks", "Net", "Status"]} empty={data?.length ? undefined : "No attendance recorded yet."}>
          {(data ?? []).map((s) => (
            <tr key={s.id}>
              <td>{formatDay(s.work_date)}</td>
              <td className="tnum">{formatTime(s.clock_in_at, org.timezone)}</td>
              <td className="tnum">{formatTime(s.clock_out_at, org.timezone)}</td>
              <td className="tnum">{formatHM(s.break_seconds)}</td>
              <td className="tnum font-medium">{formatHM(s.net_seconds)}</td>
              <td>{statusBadge(s.status)} {s.is_adjusted && <Badge tone="pause">Adjusted</Badge>}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
