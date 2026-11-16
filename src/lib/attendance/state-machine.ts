import type { EventType } from "@/types";
import type { AttendanceStatus } from "./calculations";

/**
 * Mirrors the rules enforced in Postgres (record_attendance_event).
 * The client uses it only to enable/disable buttons; the database is authoritative.
 */
export const TRANSITIONS: Record<AttendanceStatus, Partial<Record<EventType, AttendanceStatus>>> = {
  not_started: { CLOCK_IN: "working" },
  working: { BREAK_START: "on_break", CLOCK_OUT: "completed" },
  on_break: { BREAK_END: "working" },
  completed: {},
};

export function canPerform(status: AttendanceStatus, action: EventType) {
  return action in TRANSITIONS[status];
}
