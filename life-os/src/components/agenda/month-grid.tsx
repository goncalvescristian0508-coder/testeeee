"use client";

import { useState } from "react";
import { toast } from "sonner";
import { moveOccurrence } from "@/lib/actions/events";
import type { EventOccurrence } from "@/lib/data/events";
import type { TaskWithSubtasks } from "@/lib/data/tasks";
import type { CategoryRow } from "@/lib/database.types";
import { addDaysStr, dateRange, endOfMonthStr, localToIso, normalizeTime, startOfMonthStr, startOfWeekStr, toDateStr, toTimeStr, WEEKDAY_LABELS } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface Props {
  month: string; // qualquer data do mês
  occurrences: EventOccurrence[];
  tasks: TaskWithSubtasks[];
  categories: CategoryRow[];
  tz: string;
  today: string;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  onSelectDay: (date: string) => void;
  onSelect: (o: EventOccurrence) => void;
}

export function MonthGrid({ month, occurrences, tasks, categories, tz, today, weekStartsOn, onSelectDay, onSelect }: Props) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const first = startOfMonthStr(month);
  const last = endOfMonthStr(month);
  const gridStart = startOfWeekStr(first, weekStartsOn);
  const gridEnd = addDaysStr(startOfWeekStr(last, weekStartsOn), 6);
  const days = dateRange(gridStart, gridEnd);
  const byDay = new Map<string, EventOccurrence[]>();
  for (const o of occurrences) {
    const d = toDateStr(o.start_at, tz);
    byDay.set(d, [...(byDay.get(d) ?? []), o]);
  }
  const taskByDay = new Map<string, TaskWithSubtasks[]>();
  for (const t of tasks) if (t.due_date) taskByDay.set(t.due_date, [...(taskByDay.get(t.due_date) ?? []), t]);
  const labels = Array.from({ length: 7 }, (_, i) => WEEKDAY_LABELS[(weekStartsOn + i) % 7]);

  const drop = async (date: string) => {
    const o = occurrences.find((x) => x.key === dragKey);
    setDragKey(null);
    setOver(null);
    if (!o) return;
    const from = toDateStr(o.start_at, tz);
    if (from === date) return;
    const dur = new Date(o.end_at).getTime() - new Date(o.start_at).getTime();
    const newStart = localToIso(date, toTimeStr(o.start_at, tz), tz);
    const newEnd = new Date(new Date(newStart).getTime() + dur).toISOString();
    const res = await moveOccurrence(o.source.id, o.originalDate, newStart, newEnd);
    if (!res.ok) toast.error(res.error);
    else toast.success("Compromisso remarcado.");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border text-center text-[11px] uppercase text-muted-foreground">
        {labels.map((l) => (
          <div key={l} className="py-2">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = d >= first && d <= last;
          const list = byDay.get(d) ?? [];
          const tl = taskByDay.get(d) ?? [];
          return (
            <div
              key={d}
              onDragOver={(e) => { e.preventDefault(); setOver(d); }}
              onDragLeave={() => setOver((o) => (o === d ? null : o))}
              onDrop={() => drop(d)}
              className={cn("min-h-20 border-b border-r border-border p-1 sm:min-h-24", !inMonth && "bg-muted/30 text-muted-foreground", over === d && "bg-success/10")}
            >
              <button type="button" onClick={() => onSelectDay(d)} className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium hover:bg-accent", d === today && "bg-success text-success-foreground")}>
                {Number(d.slice(8, 10))}
              </button>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((o) => {
                  const cat = categories.find((c) => c.id === o.source.category_id);
                  const color = cat?.color ?? "#38bdf8";
                  return (
                    <button
                      key={o.key}
                      type="button"
                      draggable
                      onDragStart={() => setDragKey(o.key)}
                      onDragEnd={() => { setDragKey(null); setOver(null); }}
                      onClick={() => onSelect(o)}
                      className={cn("block w-full truncate rounded px-1 text-left text-[10px] leading-4 sm:text-[11px]", dragKey === o.key && "opacity-50")}
                      style={{ backgroundColor: color + "26", color }}
                    >
                      {!o.source.all_day ? <span className="hidden sm:inline">{normalizeTime(toTimeStr(o.start_at, tz))} </span> : null}
                      {o.source.title}
                    </button>
                  );
                })}
                {tl.slice(0, 2).map((t) => (
                  <div key={t.id} className={cn("truncate rounded border border-dashed px-1 text-[10px] leading-4", t.status === "done" ? "border-border text-muted-foreground line-through" : t.due_date! < today ? "border-destructive/50 text-destructive" : "border-border")}>{t.title}</div>
                ))}
                {list.length + tl.length > 5 ? <button type="button" onClick={() => onSelectDay(d)} className="text-[10px] text-muted-foreground">+{list.length + tl.length - 5} mais</button> : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-3 py-1.5 text-[11px] text-muted-foreground">Arraste um compromisso para outro dia para remarcar.</p>
    </div>
  );
}
