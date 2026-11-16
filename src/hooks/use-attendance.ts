"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { summarize, type AttEvent } from "@/lib/attendance/calculations";
import { canPerform } from "@/lib/attendance/state-machine";
import * as store from "@/lib/offline/queue";
import { todayInTz } from "@/lib/time";
import type { EventType } from "@/types";

export function useAttendance(userId: string, timezone: string) {
  const supabase = useMemo(() => createClient(), []);
  const [serverEvents, setServerEvents] = useState<AttEvent[]>([]);
  const [queue, setQueue] = useState<store.QueuedEvent[]>([]);
  const [online, setOnline] = useState(true);
  const [ready, setReady] = useState(false);
  const flushing = useRef(false);

  const refreshQueue = useCallback(() => setQueue(store.readQueue(userId)), [userId]);

  const loadServer = useCallback(async () => {
    const fallback = () => setServerEvents(store.readSnapshot(userId));
    const { data: s, error } = await supabase
      .from("attendance_sessions").select("id,status,work_date")
      .eq("employee_id", userId).order("clock_in_at", { ascending: false }).limit(1);
    if (error) return fallback();

    const session = s?.[0];
    const relevant = session && (session.status !== "completed" || session.work_date === todayInTz(timezone));
    if (!relevant) { setServerEvents([]); store.writeSnapshot(userId, []); return; }

    const withVoided = await supabase
      .from("attendance_events").select("id,event_type,occurred_at,voided")
      .eq("session_id", session.id).order("occurred_at");
    let ev = withVoided.data as AttEvent[] | null;
    let evErr = withVoided.error;
    if (evErr) {
      // 0002 migration not applied yet: read the old columns.
      const plain = await supabase
        .from("attendance_events").select("id,event_type,occurred_at")
        .eq("session_id", session.id).order("occurred_at");
      ev = plain.data as AttEvent[] | null;
      evErr = plain.error;
    }
    if (evErr) return fallback();
    setServerEvents(ev ?? []);
    store.writeSnapshot(userId, ev ?? []);
  }, [supabase, userId, timezone]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const item of store.readQueue(userId)) {
        if (item.sync_status === "failed") continue;
        const { error } = await supabase.rpc("record_attendance_event", {
          p_event_id: item.id, p_type: item.event_type,
          p_occurred_at: item.occurred_at, p_device_id: item.device_id,
        });
        if (!error) { store.markSynced(userId, item.id); continue; }
        if (error.code) { store.markFailed(userId, item.id, error.message); break; } // rejected by the rules
        break; // no code => network problem; keep queued and retry later
      }
    } finally {
      flushing.current = false;
      refreshQueue();
      await loadServer();
    }
  }, [supabase, userId, refreshQueue, loadServer]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refreshQueue();
    setServerEvents(store.readSnapshot(userId));
    setReady(true);
    void flush();
    const on = () => { setOnline(true); void flush(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const timer = setInterval(() => { void flush(); }, 30_000);
    const vis = () => { if (document.visibilityState === "visible") void flush(); };
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      document.removeEventListener("visibilitychange", vis);
      clearInterval(timer);
    };
  }, [userId, flush, refreshQueue]);

  const pendingEvents = queue.filter((q) => q.sync_status === "pending");
  const failedEvents = queue.filter((q) => q.sync_status === "failed");

  const events = useMemo(() => {
    const ids = new Set(serverEvents.map((e) => e.id));
    return [...serverEvents, ...pendingEvents.filter((q) => !ids.has(q.id))];
  }, [serverEvents, pendingEvents]);

  const act = useCallback(async (type: EventType) => {
    if (!canPerform(summarize(events).status, type)) return;
    store.enqueue(userId, {
      id: crypto.randomUUID(), event_type: type, occurred_at: new Date().toISOString(),
      device_id: store.getDeviceId(), sync_status: "pending",
    });
    refreshQueue();
    await flush();
  }, [events, userId, refreshQueue, flush]);

  return {
    events, ready, online, act, flush,
    pendingCount: pendingEvents.length,
    failed: failedEvents,
    retryFailed: () => { store.retryFailed(userId); refreshQueue(); void flush(); },
    discardFailed: () => { store.discardFailed(userId); refreshQueue(); },
    pendingIds: new Set(pendingEvents.map((p) => p.id)),
  };
}
