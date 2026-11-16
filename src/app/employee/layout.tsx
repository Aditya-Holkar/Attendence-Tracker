import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { SidebarSkeleton } from "@/components/sidebar-skeleton";

async function EmployeeSidebar() {
  const { profile } = await requireProfile();
  return (
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
  );
}

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <Suspense fallback={<SidebarSkeleton />}>
        <EmployeeSidebar />
      </Suspense>
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
