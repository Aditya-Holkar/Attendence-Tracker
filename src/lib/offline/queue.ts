/**
 * Offline event queue (MVP). Every attendance event is written here BEFORE the
 * UI shows success, then synced to Postgres. Event ids are UUIDs made on the
 * device and the database function is idempotent, so retries never duplicate.
 *
 * To upgrade to PowerSync, replace this module's functions with reads/writes
 * against the PowerSync local SQLite database; the hook's contract stays the same.
 */
import type { AttEvent } from "@/lib/attendance/calculations";
import type { EventType } from "@/types";

export interface QueuedEvent {
  id: string;
  event_type: EventType;
  occurred_at: string;
  device_id: string;
  sync_status: "pending" | "failed";
  error?: string;
}

const qKey = (u: string) => `att:queue:${u}`;
const sKey = (u: string) => `att:snapshot:${u}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export const readQueue = (u: string) => read<QueuedEvent[]>(qKey(u), []);
export const writeSnapshot = (u: string, events: AttEvent[]) => write(sKey(u), events);
export const readSnapshot = (u: string) => read<AttEvent[]>(sKey(u), []);

export function enqueue(u: string, e: QueuedEvent) {
  write(qKey(u), [...readQueue(u), e]);
}
export function markSynced(u: string, id: string) {
  write(qKey(u), readQueue(u).filter((e) => e.id !== id));
}
export function markFailed(u: string, id: string, error: string) {
  write(qKey(u), readQueue(u).map((e) => (e.id === id ? { ...e, sync_status: "failed", error } : e)));
}
export function retryFailed(u: string) {
  write(qKey(u), readQueue(u).map((e) => ({ ...e, sync_status: "pending", error: undefined })));
}
export function discardFailed(u: string) {
  write(qKey(u), readQueue(u).filter((e) => e.sync_status !== "failed"));
}

export function getDeviceId() {
  const k = "att:device";
  try {
    let id = localStorage.getItem(k);
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(k, id); }
    return id;
  } catch {
    return "unknown";
  }
}
