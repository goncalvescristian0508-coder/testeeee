import type { FocusSessionRow } from "@/lib/database.types";
import { addDaysStr, dateRange, startOfWeekStr, toDateStr } from "@/lib/dates";

export const POMODORO = { focus: 25, short: 5, long: 15, cyclesBeforeLong: 4 };

export interface FocusDay {
  date: string;
  minutes: number;
  sessions: number;
  completed: number;
}

export function focusByDay(sessions: FocusSessionRow[], from: string, to: string, tz: string): FocusDay[] {
  const map = new Map<string, FocusDay>();
  for (const d of dateRange(from, to)) map.set(d, { date: d, minutes: 0, sessions: 0, completed: 0 });
  for (const s of sessions) {
    const d = toDateStr(s.started_at, tz);
    const row = map.get(d);
    if (!row) continue;
    row.minutes += s.actual_seconds / 60;
    row.sessions++;
    if (s.completed) row.completed++;
  }
  return [...map.values()].map((r) => ({ ...r, minutes: Math.round(r.minutes) }));
}

export function focusTotals(sessions: FocusSessionRow[], tz: string, today: string, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6) {
  const weekStart = startOfWeekStr(today, weekStartsOn);
  const monthStart = today.slice(0, 7) + "-01";
  const sum = (pred: (d: string) => boolean) => Math.round(sessions.filter((s) => pred(toDateStr(s.started_at, tz))).reduce((a, s) => a + s.actual_seconds, 0) / 60);
  return {
    today: sum((d) => d === today),
    week: sum((d) => d >= weekStart),
    month: sum((d) => d >= monthStart),
    completedRate: sessions.length ? Math.round((sessions.filter((s) => s.completed).length / sessions.length) * 100) : 0,
    socialFreeMinutes: Math.round(sessions.filter((s) => s.avoid_social && toDateStr(s.started_at, tz) >= addDaysStr(today, -7)).reduce((a, s) => a + s.actual_seconds, 0) / 60),
  };
}

export function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
