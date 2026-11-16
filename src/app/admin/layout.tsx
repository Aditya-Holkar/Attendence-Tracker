import { requireProfile } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile(["admin", "manager"]);
  const items = [
    { href: "/admin/dashboard", label: "Overview" },
    { href: "/admin/timesheets", label: "Timesheets" },
    { href: "/admin/approvals", label: "Approvals" },
    { href: "/admin/reports", label: "Reports" },
    ...(profile.role === "admin"
      ? [{ href: "/admin/employees", label: "Employees" }, { href: "/admin/settings", label: "Settings" }]
      : []),
  ];
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar title={profile.role === "admin" ? "Admin" : "Team"} name={profile.full_name || profile.email}
        items={items} switchTo={{ href: "/employee/dashboard", label: "My timesheet" }} />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
