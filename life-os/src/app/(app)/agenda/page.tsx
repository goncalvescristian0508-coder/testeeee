import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AgendaView, type AgendaViewMode } from "@/components/agenda/agenda-view";
import { getUserContext } from "@/lib/context";
import { loadOccurrences } from "@/lib/data/events";
import { loadTasks } from "@/lib/data/tasks";
import { loadCategories } from "@/lib/data/categories";
import { addDaysStr, endOfMonthStr, isValidDateStr, nowTimeStr, startOfMonthStr, timeToMinutes } from "@/lib/dates";

export const metadata: Metadata = { title: "Agenda" };

const VIEWS: AgendaViewMode[] = ["dia", "semana", "mes", "lista"];

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ view?: string; data?: string }> }) {
  const sp = await searchParams;
  const ctx = await getUserContext();
  const view = (VIEWS.includes(sp.view as AgendaViewMode) ? sp.view : "semana") as AgendaViewMode;
  const date = sp.data && isValidDateStr(sp.data) ? sp.data : ctx.today;
  // Intervalo amplo o suficiente para qualquer visualização a partir de `date`.
  const from = addDaysStr(startOfMonthStr(date), -7);
  const to = addDaysStr(endOfMonthStr(date), 42);
  const [occurrences, tasks, categories] = await Promise.all([loadOccurrences(ctx, from, to), loadTasks(ctx, { from, to, includeDone: true }), loadCategories(ctx)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Agenda" description="Compromissos, prazos e blocos de tempo." />
      <Suspense>
        <AgendaView view={view} date={date} occurrences={occurrences} tasks={tasks} categories={categories.filter((c) => c.kind === "event" || c.kind === "general")} tz={ctx.tz} today={ctx.today} weekStartsOn={ctx.weekStartsOn} nowMinutes={timeToMinutes(nowTimeStr(ctx.tz))} />
      </Suspense>
    </div>
  );
}
