"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the server page when attendance changes (RLS still applies).
 * Bursts of change events are coalesced into at most one refresh every 1.5s,
 * and nothing is refreshed while the tab is hidden.
 */
export function RealtimeRefresh({ table = "attendance_sessions" }: { table?: string }) {
  const router = useRouter();
  const sb = useMemo(() => createClient(), []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dirty = false;

    const refresh = () => {
      timer = null;
      if (!dirty) return;
      dirty = false;
      router.refresh();
    };

    const schedule = () => {
      dirty = true;
      if (document.visibilityState === "hidden" || timer) return;
      timer = setTimeout(refresh, 1500);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };

    const ch = sb.channel(`live-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, schedule)
      .subscribe();

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void sb.removeChannel(ch);
    };
  }, [sb, router, table]);

  return null;
}
