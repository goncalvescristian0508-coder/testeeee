"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { iconFor } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { HabitCheck } from "./habit-check";
import type { HabitWithState } from "@/lib/data/habits";
import { normalizeTime } from "@/lib/dates";

interface HabitRowProps {
  item: HabitWithState;
  today: string;
  compact?: boolean;
  dragHandle?: React.ReactNode;
}

export function HabitRowItem({ item, today, compact, dragHandle }: HabitRowProps) {
  const { habit, todayStatus, todayCompletion, streak, currentSchedule, weeklyDone } = item;
  const Icon = iconFor(habit.icon);
  const notScheduled = todayStatus === "not_scheduled";
  const done = todayStatus === "done";
  const tpw = currentSchedule?.frequency === "times_per_week" ? currentSchedule.times_per_week ?? 0 : 0;

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors", done && "border-success/30 bg-success/5", notScheduled && "opacity-60", habit.status !== "active" && "opacity-70")}>
      {dragHandle}
      <Link href={`/habitos/${habit.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: habit.color + "22", color: habit.color }}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-medium", done && "line-through decoration-success/60 text-muted-foreground")}>{habit.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {habit.recommended_time ? <span>{normalizeTime(habit.recommended_time)}</span> : null}
            {habit.target_value != null ? (
              <span>
                {todayCompletion?.value != null ? `${todayCompletion.value}/` : ""}
                {habit.target_value} {habit.unit ?? ""}
              </span>
            ) : null}
            {tpw ? <span>{weeklyDone}/{tpw} esta semana</span> : null}
            {notScheduled ? <span>Não programado hoje</span> : null}
            {habit.status === "paused" ? <span className="text-warning">Pausado</span> : null}
            {habit.status === "archived" ? <span>Arquivado</span> : null}
            {!compact && streak.current > 0 ? (
              <span className="flex items-center gap-0.5 text-success">
                <Flame className="size-3" /> {streak.current}
              </span>
            ) : null}
          </span>
        </span>
      </Link>
      {habit.status === "active" ? <HabitCheck habit={habit} date={today} status={todayStatus} value={todayCompletion?.value} showMenu={!compact} size={compact ? "sm" : "md"} /> : null}
    </div>
  );
}
