"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Re-renders the server page whenever attendance changes (RLS still applies). */
export function RealtimeRefresh({ table = "attendance_sessions" }: { table?: string }) {
  const router = useRouter();
  const sb = useMemo(() => createClient(), []);
  useEffect(() => {
    const ch = sb.channel(`live-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => router.refresh())
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [sb, router, table]);
  return null;
}
