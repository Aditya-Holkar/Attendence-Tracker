import { addHoliday, createDepartment, createSchedule, updateOrgSettings } from "@/app/actions";
import { btnCls, Card, Field, inputCls, PageHeader, Table } from "@/components/ui";
import { getOrg, requireProfile } from "@/lib/auth";

export default async function Settings() {
  const { supabase } = await requireProfile(["admin"]);
  const org = await getOrg();
  const [{ data: scheds }, { data: depts }, { data: holidays }] = await Promise.all([
    supabase.from("work_schedules").select("*").order("name"),
    supabase.from("departments").select("*").order("name"),
    supabase.from("holidays").select("*").order("holiday_date", { ascending: false }).limit(20),
  ]);

  return (
    <>
      <PageHeader title="Settings" />
      <Card title="Organisation" className="mb-4">
        <form action={updateOrgSettings} className="grid gap-4 sm:grid-cols-4">
          <Field label="Name"><input name="name" defaultValue={org.name} className={inputCls} /></Field>
          <Field label="Timezone (IANA)"><input name="timezone" defaultValue={org.timezone} className={inputCls} /></Field>
          <Field label="Break allowance (min)"><input type="number" name="max_break_minutes" defaultValue={org.max_break_minutes} className={inputCls} /></Field>
          <Field label="Overtime after (min/day)"><input type="number" name="overtime_after_minutes" defaultValue={org.overtime_after_minutes} className={inputCls} /></Field>
          <div className="sm:col-span-4"><button className={btnCls}>Save changes</button></div>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Work schedules">
          <Table head={["Name", "Hours", "Grace"]} empty={scheds?.length ? undefined : "No schedules yet."}>
            {(scheds ?? []).map((s) => <tr key={s.id}><td>{s.name}</td><td className="tnum">{s.start_time.slice(0, 5)} to {s.end_time.slice(0, 5)}</td><td>{s.grace_minutes} min</td></tr>)}
          </Table>
          <form action={createSchedule} className="mt-4 grid gap-3 sm:grid-cols-5">
            <input name="name" placeholder="Name" required className={`${inputCls} sm:col-span-2`} />
            <input type="time" name="start_time" defaultValue="09:00" className={inputCls} aria-label="Start" />
            <input type="time" name="end_time" defaultValue="18:00" className={inputCls} aria-label="End" />
            <input type="number" name="grace_minutes" defaultValue={10} className={inputCls} aria-label="Grace minutes" />
            <input type="number" name="expected_minutes" defaultValue={480} className={inputCls} aria-label="Expected minutes" />
            <button className={`${btnCls} sm:col-span-5`}>Add schedule</button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card title="Departments">
            <p className="mb-3 text-sm">{(depts ?? []).map((d) => d.name).join(", ") || "None yet."}</p>
            <form action={createDepartment} className="flex gap-2">
              <input name="name" placeholder="Department name" required className={inputCls} />
              <button className={btnCls}>Add</button>
            </form>
          </Card>
          <Card title="Holidays">
            <Table head={["Date", "Holiday"]} empty={holidays?.length ? undefined : "No holidays yet."}>
              {(holidays ?? []).map((h) => <tr key={h.id}><td>{h.holiday_date}</td><td>{h.name}</td></tr>)}
            </Table>
            <form action={addHoliday} className="mt-3 flex flex-wrap gap-2">
              <input type="date" name="holiday_date" required className={`${inputCls} w-auto`} />
              <input name="name" placeholder="Holiday name" required className={`${inputCls} w-auto flex-1`} />
              <button className={btnCls}>Add</button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
