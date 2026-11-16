"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { summarize, type AttEvent } from "@/lib/attendance/calculations";
import { canPerform } from "@/lib/attendance/state-machine";
import * as store from "@/lib/offline/queue";
import { todayInTz } from "@/lib/time";
import type { EventType } from "@/types";

type SessionWithEvents = {
  id: string;
  status: string;
  work_date: string;
  attendance_events?: AttEvent[] | null;
};

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

    // One request instead of two: the session and its events come back together.
    const { data, error } = await supabase
      .from("attendance_sessions")
      .select("id,status,work_date,attendance_events(id,event_type,occurred_at,voided)")
      .eq("employee_id", userId).order("clock_in_at", { ascending: false }).limit(1);

    let session = (data?.[0] ?? null) as SessionWithEvents | null;

    // Pre-0002 databases do not have attendance_events.voided yet.
    if (error) {
      const plain = await supabase
        .from("attendance_sessions")
        .select("id,status,work_date,attendance_events(id,event_type,occurred_at)")
        .eq("employee_id", userId).order("clock_in_at", { ascending: false }).limit(1);
      if (plain.error) return fallback();
      session = (plain.data?.[0] ?? null) as SessionWithEvents | null;
    }

    if (!session || (session.status === "completed" && session.work_date !== todayInTz(timezone))) {
      setServerEvents([]);
      store.writeSnapshot(userId, []);
      return;
    }

    const events = [...(session.attendance_events ?? [])].sort(
      (a, b) => +new Date(a.occurred_at) - +new Date(b.occurred_at),
    );
    setServerEvents(events);
    store.writeSnapshot(userId, events);
  }, [supabase, userId, timezone]);

  const flush = useCallback(async (reload = false) => {
    if (flushing.current) return;
    flushing.current = true;
    let changed = false;
    try {
      for (const item of store.readQueue(userId)) {
        if (item.sync_status === "failed") continue;
        const { error } = await supabase.rpc("record_attendance_event", {
          p_event_id: item.id, p_type: item.event_type,
          p_occurred_at: item.occurred_at, p_device_id: item.device_id,
        });
        if (!error) { store.markSynced(userId, item.id); changed = true; continue; }
        if (error.code) { store.markFailed(userId, item.id, error.message); changed = true; break; } // rejected by the rules
        break; // no code => network problem; keep queued and retry later
      }
    } finally {
      flushing.current = false;
      refreshQueue();
      // Only hit the database when something actually synced. The old code
      // reloaded every 30s even with an empty queue.
      if (changed || reload) await loadServer();
    }
  }, [supabase, userId, refreshQueue, loadServer]);

  useEffect(() => {
    setOnline(navigator.onLine);
    refreshQueue();
    setServerEvents(store.readSnapshot(userId));
    setReady(true);
    void flush(true);
    const on = () => { setOnline(true); void flush(true); };
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
