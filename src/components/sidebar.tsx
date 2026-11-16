"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";

export interface NavItem { href: string; label: string }

/** Shows a small dot only when a navigation is actually taking a moment. */
function PendingDot() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current transition-opacity ${
        pending ? "opacity-100 delay-150" : "opacity-0"
      }`}
    />
  );
}

/**
 * Dashboard pages are dynamic, so Next only partial-prefetches their loading
 * shell on entering the viewport. Once the pointer or keyboard focus is on a
 * link we know the destination is likely, so ask for a full prefetch: by the
 * time it is clicked, the server render and its data are already cached.
 */
function NavLink({ item, active, muted = false }: {
  item: NavItem; active: boolean; muted?: boolean;
}) {
  const [hot, setHot] = useState(false);
  return (
    <Link
      href={item.href}
      prefetch={hot ? true : null}
      onMouseEnter={() => setHot(true)}
      onFocus={() => setHot(true)}
      className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm ${
        active
          ? "bg-work-soft font-medium text-work"
          : muted
            ? "text-muted hover:bg-surface-2"
            : "text-ink hover:bg-surface-2"
      }`}
    >
      {item.label}
      <PendingDot />
    </Link>
  );
}

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
        {items.map((i) => (
          <NavLink
            key={i.href}
            item={i}
            active={path === i.href || path.startsWith(i.href + "/")}
          />
        ))}
        {switchTo && (
          <NavLink item={switchTo} active={path === switchTo.href} muted />
        )}
      </nav>
      <form action={signOut} className="hidden p-3 md:block">
        <button className="w-full rounded-md border border-line px-3 py-2 text-sm hover:bg-surface-2">Sign out</button>
      </form>
    </aside>
  );
}
