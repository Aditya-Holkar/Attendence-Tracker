"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";

export interface NavItem { href: string; label: string }

export function Sidebar({ title, name, items, switchTo }: {
  title: string; name: string; items: NavItem[]; switchTo?: NavItem;
}) {
  const path = usePathname();
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-line bg-surface md:w-56 md:border-b-0 md:border-r">
      <div className="flex items-start justify-between gap-2 px-4 py-4">
        <div className="min-w-0">
          <Link href="/" className="block font-semibold tracking-tight">{title}</Link>
          <p className="truncate text-xs text-muted">{name}</p>
        </div>
        <ThemeToggle />
      </div>
      <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-1 md:flex-col md:overflow-visible">
        {items.map((i) => {
          const active = path === i.href || path.startsWith(i.href + "/");
          return (
            <Link key={i.href} href={i.href}
              className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${active ? "bg-work-soft font-medium text-work" : "text-ink hover:bg-surface-2"}`}>
              {i.label}
            </Link>
          );
        })}
        {switchTo && (
          <Link href={switchTo.href} className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-muted hover:bg-surface-2">
            {switchTo.label}
          </Link>
        )}
      </nav>
      <form action={signOut} className="hidden p-3 md:block">
        <button className="w-full rounded-md border border-line px-3 py-2 text-sm hover:bg-surface-2">Sign out</button>
      </form>
    </aside>
  );
}
