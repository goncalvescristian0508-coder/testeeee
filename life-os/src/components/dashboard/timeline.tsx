"use client";

import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { TaskItem } from "@/components/tasks/task-item";
import { HabitRowItem } from "@/components/habits/habit-row";
import type { HabitWithState } from "@/lib/data/habits";
import type { TaskWithSubtasks } from "@/lib/data/tasks";
import type { EventOccurrence } from "@/lib/data/events";
import type { CategoryRow } from "@/lib/database.types";
import { PERIOD_LABEL, normalizeTime, periodOfTime, timeToMinutes, toTimeStr, type DayPeriods } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Period = "morning" | "afternoon" | "evening";
type Entry =
  | { type: "task"; time: number | null; task: TaskWithSubtasks }
  | { type: "event"; time: number; occ: EventOccurrence }
  | { type: "habit"; time: number | null; item: HabitWithState };

interface TimelineProps {
  tasks: TaskWithSubtasks[];
  habits: HabitWithState[];
  occurrences: EventOccurrence[];
  categories: CategoryRow[];
  today: string;
  tz: string;
  periods: DayPeriods;
  nowMinutes: number;
}

export function Timeline({ tasks, habits, occurrences, categories, today, tz, periods, nowMinutes }: TimelineProps) {
  const groups: Record<Period, Entry[]> = { morning: [], afternoon: [], evening: [] };
  const current = periodOfTime(`${String(Math.floor(nowMinutes / 60)).padStart(2, "0")}:${String(nowMinutes % 60).padStart(2, "0")}`, periods);

  for (const t of tasks) {
    if (t.status === "done" && t.due_date !== today) continue;
    const time = t.due_time ? timeToMinutes(t.due_time) : null;
    const p = t.period ?? (t.due_time ? periodOfTime(t.due_time, periods) : current);
    groups[p].push({ type: "task", time, task: t });
  }
  for (const o of occurrences) {
    const time = o.source.all_day ? 0 : timeToMinutes(toTimeStr(o.start_at, tz));
    const p = o.source.all_day ? "morning" : periodOfTime(toTimeStr(o.start_at, tz), periods);
    groups[p].push({ type: "event", time, occ: o });
  }
  for (const h of habits) {
    if (h.todayStatus === "not_scheduled") continue;
    const time = h.habit.recommended_time ? timeToMinutes(h.habit.recommended_time) : null;
    const p = h.habit.period ?? (h.habit.recommended_time ? periodOfTime(h.habit.recommended_time, periods) : "morning");
    groups[p].push({ type: "habit", time, item: h });
  }
  for (const p of Object.keys(groups) as Period[]) groups[p].sort((a, b) => (a.time ?? 9999) - (b.time ?? 9999));

  const empty = (["morning", "afternoon", "evening"] as Period[]).every((p) => groups[p].length === 0);
  if (empty) return <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nada agendado para hoje. Adicione uma tarefa, compromisso ou hábito.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(["morning", "afternoon", "evening"] as Period[]).map((p) => (
        <section key={p} className={cn("rounded-xl border border-border bg-card/50 p-3", current === p && "border-success/30")}>
          <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {PERIOD_LABEL[p]}
            {current === p ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] normal-case tracking-normal text-success">agora</span> : null}
          </h3>
          {groups[p].length === 0 ? (
            <p className="px-1 py-3 text-xs text-muted-foreground">Livre.</p>
          ) : (
            <div className="space-y-2">
              {groups[p].map((e) => {
                if (e.type === "task") return <TaskItem key={e.task.id} task={e.task} today={today} categories={categories} compact />;
                if (e.type === "habit") return <HabitRowItem key={e.item.habit.id} item={e.item} today={today} compact />;
                const o = e.occ;
                const past = o.end_at < new Date().toISOString();
                return (
                  <Link key={o.key} href={`/agenda?data=${today}`} className={cn("flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-accent/50", past && "opacity-60")}>
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-chart-4/15 text-chart-4">
                      <Clock className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{o.source.title}</span>
                      <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        <span>{o.source.all_day ? "Dia inteiro" : `${normalizeTime(toTimeStr(o.start_at, tz))} – ${normalizeTime(toTimeStr(o.end_at, tz))}`}</span>
                        {o.source.location ? <span className="flex items-center gap-0.5"><MapPin className="size-3" />{o.source.location}</span> : null}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
