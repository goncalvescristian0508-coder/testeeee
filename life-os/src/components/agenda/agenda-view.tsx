"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventFormDialog } from "@/components/events/event-form";
import { OccurrenceDialog } from "./occurrence-dialog";
import { TimeGrid } from "./time-grid";
import { MonthGrid } from "./month-grid";
import { UpcomingList } from "./upcoming-list";
import type { EventOccurrence } from "@/lib/data/events";
import type { TaskWithSubtasks } from "@/lib/data/tasks";
import type { CategoryRow } from "@/lib/database.types";
import { addDaysStr, addMonthsStr, dateRange, fmtDate, startOfWeekStr, toDateStr } from "@/lib/dates";

export type AgendaViewMode = "dia" | "semana" | "mes" | "lista";

interface Props {
  view: AgendaViewMode;
  date: string;
  occurrences: EventOccurrence[];
  tasks: TaskWithSubtasks[];
  categories: CategoryRow[];
  tz: string;
  today: string;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  nowMinutes: number;
}

export function AgendaView({ view, date, occurrences, tasks, categories, tz, today, weekStartsOn, nowMinutes }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, start] = useTransition();
  const [selected, setSelected] = useState<EventOccurrence | null>(null);
  const [create, setCreate] = useState<{ date: string; start_time?: string } | null>(null);

  const navigate = (next: { view?: AgendaViewMode; date?: string }) => {
    const p = new URLSearchParams(params.toString());
    p.set("view", next.view ?? view);
    p.set("data", next.date ?? date);
    start(() => router.replace(`/agenda?${p.toString()}`, { scroll: false }));
  };

  const shift = (dir: -1 | 1) => {
    if (view === "dia") navigate({ date: addDaysStr(date, dir) });
    else if (view === "semana") navigate({ date: addDaysStr(date, 7 * dir) });
    else if (view === "mes") navigate({ date: addMonthsStr(date, dir) });
    else navigate({ date: addDaysStr(date, 30 * dir) });
  };

  const weekStart = startOfWeekStr(date, weekStartsOn);
  const weekDays = dateRange(weekStart, addDaysStr(weekStart, 6));
  const title =
    view === "dia" ? fmtDate(date, "EEEE, d 'de' MMMM") : view === "semana" ? `${fmtDate(weekStart, "d MMM")} – ${fmtDate(addDaysStr(weekStart, 6), "d MMM yyyy")}` : view === "mes" ? fmtDate(date, "MMMM yyyy") : `A partir de ${fmtDate(date, "d 'de' MMMM")}`;

  const inRange = (from: string, to: string) => occurrences.filter((o) => { const d = toDateStr(o.start_at, tz); return d >= from && d <= to; });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Anterior" onClick={() => shift(-1)}><ChevronLeft /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Próximo" onClick={() => shift(1)}><ChevronRight /></Button>
          <Button variant="ghost" size="sm" onClick={() => navigate({ date: today })}>Hoje</Button>
          <h2 className="ml-1 text-base font-semibold capitalize sm:text-lg">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => navigate({ view: v as AgendaViewMode })}>
            <TabsList>
              <TabsTrigger value="dia">Dia</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
              <TabsTrigger value="lista">Lista</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" onClick={() => setCreate({ date: view === "lista" ? today : date })}><Plus /> Novo</Button>
        </div>
      </div>

      {view === "dia" ? (
        <TimeGrid days={[date]} occurrences={inRange(date, date)} tasks={tasks.filter((t) => t.due_date === date)} categories={categories} tz={tz} today={today} nowMinutes={nowMinutes} onSelect={setSelected} onCreate={(d, t) => setCreate({ date: d, start_time: t })} />
      ) : null}
      {view === "semana" ? (
        <TimeGrid days={weekDays} occurrences={inRange(weekDays[0], weekDays[6])} tasks={tasks.filter((t) => t.due_date && t.due_date >= weekDays[0] && t.due_date <= weekDays[6])} categories={categories} tz={tz} today={today} nowMinutes={nowMinutes} onSelect={setSelected} onCreate={(d, t) => setCreate({ date: d, start_time: t })} />
      ) : null}
      {view === "mes" ? (
        <MonthGrid month={date} occurrences={occurrences} tasks={tasks} categories={categories} tz={tz} today={today} weekStartsOn={weekStartsOn} onSelectDay={(d) => navigate({ view: "dia", date: d })} onSelect={setSelected} />
      ) : null}
      {view === "lista" ? <UpcomingList occurrences={inRange(date, addDaysStr(date, 30))} categories={categories} tz={tz} today={today} onSelect={setSelected} /> : null}

      <OccurrenceDialog occurrence={selected} onClose={() => setSelected(null)} categories={categories} tz={tz} today={today} />
      <EventFormDialog open={!!create} onOpenChange={(v) => !v && setCreate(null)} categories={categories} tz={tz} today={today} defaults={create ?? undefined} />
    </div>
  );
}
