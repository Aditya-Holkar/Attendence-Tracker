import type { EventType } from "@/types";

export type AttendanceStatus = "not_started" | "working" | "on_break" | "completed";

export interface AttEvent {
  id: string;
  event_type: EventType;
  occurred_at: string;
}

export interface Summary {
  status: AttendanceStatus;
  clockInAt?: number;
  clockOutAt?: number;
  activeBreakStart?: number;
  breakSeconds: number;
  elapsedSeconds: number;
  workSeconds: number;
}

/**
 * Single source of truth for time maths. Derives everything from stored
 * timestamps, so a refresh, closed tab or offline spell never loses time.
 * `now` is only used for open intervals; a 1s UI tick merely redraws.
 */
export function summarize(events: AttEvent[], now: number = Date.now()): Summary {
  const sorted = [...events].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  );
  let status: AttendanceStatus = "not_started";
  let clockIn: number | undefined;
  let clockOut: number | undefined;
  let breakStart: number | undefined;
  let breakMs = 0;

  for (const e of sorted) {
    const t = new Date(e.occurred_at).getTime();
    switch (e.event_type) {
      case "CLOCK_IN":
        if (status === "not_started") { status = "working"; clockIn = t; }
        break;
      case "BREAK_START":
        if (status === "working") { status = "on_break"; breakStart = t; }
        break;
      case "BREAK_END":
        if (status === "on_break" && breakStart !== undefined) {
          breakMs += Math.max(0, t - breakStart);
          breakStart = undefined;
          status = "working";
        }
        break;
      case "CLOCK_OUT":
        if (status === "working") { status = "completed"; clockOut = t; }
        break;
    }
  }

  const end = clockOut ?? now;
  const activeBreakMs = breakStart !== undefined ? Math.max(0, now - breakStart) : 0;
  const elapsedSeconds = clockIn === undefined ? 0 : Math.max(0, Math.floor((end - clockIn) / 1000));
  const breakSeconds = Math.floor((breakMs + activeBreakMs) / 1000);
  return {
    status,
    clockInAt: clockIn,
    clockOutAt: clockOut,
    activeBreakStart: breakStart,
    breakSeconds,
    elapsedSeconds,
    workSeconds: Math.max(0, elapsedSeconds - breakSeconds),
  };
}

/** Net Work = Clock Out - Clock In - Total Breaks */
export function netWorkSeconds(clockIn: string, clockOut: string, breakSeconds: number) {
  const gross = Math.floor((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 1000);
  return Math.max(0, gross - breakSeconds);
}

export function isLate(clockInIso: string, timezone: string, scheduleStart: string, graceMinutes: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(clockInIso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const [sh, sm] = scheduleStart.split(":").map(Number);
  return h * 60 + m > sh * 60 + sm + graceMinutes;
}
