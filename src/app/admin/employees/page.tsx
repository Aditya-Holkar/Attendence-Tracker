import { updateEmployee } from "@/app/actions";
import { btnGhost, Card, inputCls, PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import type { Profile } from "@/types";

export default async function Employees() {
  const { supabase } = await requireProfile(["admin"]);
  const [{ data: people }, { data: depts }, { data: scheds }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("work_schedules").select("id, name").order("name"),
  ]);
  const list = (people ?? []) as Profile[];
  const managers = list.filter((p) => p.role !== "employee");

  return (
    <>
      <PageHeader title="Employees" sub="New accounts appear here after they sign up. The first account is the admin." />
      <div className="space-y-3">
        {list.map((p) => (
          <Card key={p.id}>
            <form action={updateEmployee} className="grid items-end gap-3 sm:grid-cols-6">
              <input type="hidden" name="id" value={p.id} />
              <label className="text-sm sm:col-span-2"><span className="mb-1 block text-muted">{p.email}</span>
                <input name="full_name" defaultValue={p.full_name} className={inputCls} aria-label="Full name" /></label>
              <label className="text-sm"><span className="mb-1 block text-muted">Role</span>
                <select name="role" defaultValue={p.role} className={inputCls}>
                  <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
                </select></label>
              <label className="text-sm"><span className="mb-1 block text-muted">Manager</span>
                <select name="manager_id" defaultValue={p.manager_id ?? ""} className={inputCls}>
                  <option value="">None</option>
                  {managers.filter((m) => m.id !== p.id).map((m) => <option key={m.id} value={m.id}>{m.full_name || m.email}</option>)}
                </select></label>
              <label className="text-sm"><span className="mb-1 block text-muted">Department</span>
                <select name="department_id" defaultValue={p.department_id ?? ""} className={inputCls}>
                  <option value="">None</option>{(depts ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select></label>
              <label className="text-sm"><span className="mb-1 block text-muted">Schedule</span>
                <select name="schedule_id" defaultValue={p.schedule_id ?? ""} className={inputCls}>
                  <option value="">None</option>{(scheds ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={p.is_active} /> Active</label>
              <div className="sm:col-span-5 sm:text-right"><button className={btnGhost}>Save changes</button></div>
            </form>
          </Card>
        ))}
      </div>
    </>
  );
}
