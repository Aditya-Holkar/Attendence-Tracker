import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { SidebarSkeleton } from "@/components/sidebar-skeleton";

/**
 * The auth/profile read lives in a Suspense boundary instead of the layout
 * itself. Otherwise the layout blocks every navigation while it awaits
 * cookies and the profile, and `loading.tsx` cannot show.
 */
async function AdminSidebar() {
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
    <Sidebar title="Tracker" name={profile.full_name || profile.email}
      items={items} switchTo={{ href: "/employee/dashboard", label: "My timesheet" }} />
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Suspense fallback={<SidebarSkeleton />}>
        <AdminSidebar />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
