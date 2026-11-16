import { requestLeave } from "@/app/actions";
import { btnCls, Card, Field, inputCls, PageHeader, statusBadge, Table } from "@/components/ui";
import { requireProfile } from "@/lib/auth";

export default async function Leave() {
  const { supabase, profile } = await requireProfile();
  const [{ data: leaves }, { data: holidays }] = await Promise.all([
    supabase.from("leave_requests").select("*").eq("employee_id", profile.id).order("start_date", { ascending: false }),
    supabase.from("holidays").select("*").gte("holiday_date", new Date().toISOString().slice(0, 10)).order("holiday_date").limit(8),
  ]);

  return (
    <>
      <PageHeader title="Leave and holidays" />
      <Card title="Request leave" className="mb-4">
        <form action={requestLeave} className="grid gap-4 sm:grid-cols-3">
          <Field label="From"><input type="date" name="start_date" required className={inputCls} /></Field>
          <Field label="To"><input type="date" name="end_date" required className={inputCls} /></Field>
          <Field label="Type">
            <select name="leave_type" className={inputCls}>
              <option value="casual">Casual</option><option value="sick">Sick</option>
              <option value="earned">Earned</option><option value="unpaid">Unpaid</option>
            </select>
          </Field>
          <div className="sm:col-span-3"><Field label="Reason (optional)"><input name="reason" className={inputCls} /></Field></div>
          <div className="sm:col-span-3"><button className={btnCls}>Send request</button></div>
        </form>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Your requests">
          <Table head={["Dates", "Type", "Status"]} empty={leaves?.length ? undefined : "No leave requested."}>
            {(leaves ?? []).map((l) => (
              <tr key={l.id}><td>{l.start_date} to {l.end_date}</td><td className="capitalize">{l.leave_type}</td><td>{statusBadge(l.status)}</td></tr>
            ))}
          </Table>
        </Card>
        <Card title="Upcoming holidays">
          <Table head={["Date", "Holiday"]} empty={holidays?.length ? undefined : "No holidays added."}>
            {(holidays ?? []).map((h) => <tr key={h.id}><td>{h.holiday_date}</td><td>{h.name}</td></tr>)}
          </Table>
        </Card>
      </div>
    </>
  );
}
