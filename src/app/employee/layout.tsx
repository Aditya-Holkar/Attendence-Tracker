import { requireProfile } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Sidebar
        title="Tracker" name={profile.full_name || profile.email}
        items={[
          { href: "/employee/dashboard", label: "Today" },
          { href: "/employee/timesheets", label: "Timesheets" },
          { href: "/employee/corrections", label: "Corrections" },
          { href: "/employee/leave", label: "Leave" },
        ]}
        switchTo={profile.role !== "employee" ? { href: "/admin/dashboard", label: "Management view" } : undefined}
      />
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
