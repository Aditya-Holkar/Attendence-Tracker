"use client";

import { useEffect, useState } from "react";
import { useAttendance } from "@/hooks/use-attendance";
import { summarize } from "@/lib/attendance/calculations";
import { canPerform } from "@/lib/attendance/state-machine";
import { formatClock, formatHM, formatTime } from "@/lib/time";
import { statusBadge, Card, btnGhost } from "@/components/ui";

const LABEL = { CLOCK_IN: "Clock in", BREAK_START: "Break started", BREAK_END: "Break ended", CLOCK_OUT: "Clock out" } as const;

export default function ClockPanel({ userId, timezone, expectedMinutes }: {
  userId: string; timezone: string; expectedMinutes: number;
}) {
  const a = useAttendance(userId, timezone);
  const [now, setNow] = useState<number | null>(null);

  // The tick only redraws. All durations come from stored timestamps.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    const v = () => setNow(Date.now());
    document.addEventListener("visibilitychange", v);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); };
  }, []);

  const s = summarize(a.events, now ?? Date.now());
  const shown = now !== null && a.ready;
  const remaining = Math.max(0, expectedMinutes * 60 - s.workSeconds);
  const sorted = [...a.events].sort((x, y) => +new Date(x.occurred_at) - +new Date(y.occurred_at));

  const main =
    s.status === "not_started" ? { type: "CLOCK_IN" as const, text: "Clock in" } :
    s.status === "working" ? { type: "CLOCK_OUT" as const, text: "Clock out" } : null;
  const breakBtn =
    s.status === "on_break" ? { type: "BREAK_END" as const, text: "Resume work" } :
    { type: "BREAK_START" as const, text: "Start break" };

  return (
    <div className="space-y-4">
      {(!a.online || a.pendingCount > 0) && (
        <div className="rounded-lg border border-pause/30 bg-pause-soft px-4 py-3 text-sm text-pause" role="status">
          {!a.online ? "You’re offline. " : ""}
          {a.pendingCount > 0
            ? `${a.pendingCount} event${a.pendingCount > 1 ? "s" : ""} saved on this device and waiting to sync.`
            : "Attendance will be saved on this device until you’re back online."}
        </div>
      )}
      {a.failed.length > 0 && (
        <div className="rounded-lg border border-alert/30 bg-alert-soft px-4 py-3 text-sm text-alert" role="alert">
          <p className="font-medium">{a.failed.length} event{a.failed.length > 1 ? "s were" : " was"} rejected: {a.failed[0].error}</p>
          <div className="mt-2 flex gap-2">
            <button className={btnGhost} onClick={a.retryFailed}>Retry</button>
            <button className={btnGhost} onClick={a.discardFailed}>Discard</button>
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="mb-2">{statusBadge(s.status)}</div>
            <p className="tnum text-5xl font-semibold tracking-tight" aria-live="off">
              {shown ? formatClock(s.workSeconds) : "--:--:--"}
            </p>
            <p className="mt-1 text-sm text-muted">Worked today, breaks excluded</p>
          </div>
          <dl className="grid grid-cols-3 gap-x-8 gap-y-1 text-sm">
            <div><dt className="text-muted">Clocked in</dt><dd className="tnum font-medium">{s.clockInAt ? formatTime(new Date(s.clockInAt).toISOString(), timezone) : "—"}</dd></div>
            <div><dt className="text-muted">Breaks</dt><dd className="tnum font-medium">{shown ? formatClock(s.breakSeconds) : "—"}</dd></div>
            <div><dt className="text-muted">Remaining</dt><dd className="tnum font-medium">{shown && s.status !== "not_started" ? formatHM(remaining) : formatHM(expectedMinutes * 60)}</dd></div>
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {main && (
            <button onClick={() => a.act(main.type)} disabled={!a.ready || !canPerform(s.status, main.type)}
              className={`rounded-md px-6 py-3 text-base font-semibold text-white disabled:opacity-40 ${main.type === "CLOCK_IN" ? "bg-work" : "bg-alert"}`}>
              {main.text}
            </button>
          )}
          {(s.status === "working" || s.status === "on_break") && (
            <button onClick={() => a.act(breakBtn.type)} className="rounded-md bg-pause px-6 py-3 text-base font-semibold text-white">
              {breakBtn.text}
            </button>
          )}
          {s.status === "completed" && <p className="py-3 text-sm text-muted">You’re done for today. Net time {formatHM(s.workSeconds)}.</p>}
        </div>
      </Card>

      <Card title="Today’s activity">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet. Clock in to start your day.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {sorted.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span>{LABEL[e.event_type]}</span>
                <span className="tnum text-muted">
                  {formatTime(e.occurred_at, timezone)}
                  {a.pendingIds.has(e.id) && <span className="ml-2 text-pause">not synced</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
