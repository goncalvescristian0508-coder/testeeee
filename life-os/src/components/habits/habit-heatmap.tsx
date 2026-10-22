"use client";

import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addDaysStr, dateRange, fmtDate, weekdayOf } from "@/lib/dates";
import { dayStatus, type CompletionLike, type HabitLike, type ScheduleLike } from "@/lib/habits";
import { cn } from "@/lib/utils";

interface HeatmapProps {
  habit: HabitLike;
  schedules: ScheduleLike[];
  completions: CompletionLike[];
  today: string;
  weeks?: number;
  color?: string;
  onSelectDay?: (date: string) => void;
}

const LABEL: Record<string, string> = { done: "Concluído", missed: "Não feito", skipped: "Justificado", pending: "Pendente", not_scheduled: "Não programado" };

/** Calendário heatmap (estilo contribuições): colunas = semanas, linhas = dias. */
export function HabitHeatmap({ habit, schedules, completions, today, weeks = 20, color = "#22c55e", onSelectDay }: HeatmapProps) {
  const byDate = useMemo(() => new Map(completions.map((c) => [c.date, c])), [completions]);
  const end = addDaysStr(today, 6 - weekdayOf(today)); // fim da semana atual (sábado)
  const start = addDaysStr(end, -(weeks * 7 - 1));
  const days = dateRange(start, end);
  const columns: string[][] = [];
  for (let i = 0; i < days.length; i += 7) columns.push(days.slice(i, i + 7));

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="flex gap-1">
        {columns.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-1">
            {col.map((d) => {
              const st = d > today ? "future" : dayStatus(habit, schedules, byDate.get(d), d, today);
              const c = byDate.get(d);
              return (
                <Tooltip key={d}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => d <= today && onSelectDay?.(d)}
                      aria-label={`${fmtDate(d, "d 'de' MMM")}: ${LABEL[st] ?? "Futuro"}`}
                      className={cn(
                        "size-3 rounded-[3px] transition-transform hover:scale-125 sm:size-3.5",
                        st === "missed" && "bg-destructive/40",
                        st === "skipped" && "bg-muted-foreground/40",
                        st === "pending" && "bg-muted ring-1 ring-inset ring-border",
                        (st === "not_scheduled" || st === "future") && "bg-muted/50",
                        d === today && "ring-1 ring-foreground/60",
                      )}
                      style={st === "done" ? { backgroundColor: color, opacity: habit.target_value && c?.value != null ? Math.max(0.4, Math.min(1, c.value / habit.target_value)) : 1 } : undefined}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {fmtDate(d, "EEE, d 'de' MMM")} · {LABEL[st] ?? "Futuro"}
                    {c?.value != null ? ` · ${c.value} ${habit.kind === "duration" ? "min" : ""}` : ""}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm" style={{ backgroundColor: color }} /> feito</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-destructive/40" /> não feito</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-muted-foreground/40" /> justificado</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-muted/50" /> não programado</span>
      </div>
    </div>
  );
}
