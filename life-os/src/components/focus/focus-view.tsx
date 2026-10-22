"use client";

import { useTransition } from "react";
import { CheckCircle2, Timer, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { FocusTimer } from "./focus-timer";
import { FocusBarChart } from "./focus-charts";
import { deleteFocusSession } from "@/lib/actions/focus";
import { focusByDay, focusTotals, fmtClock } from "@/lib/focus";
import type { FocusSessionRow, HabitRow } from "@/lib/database.types";
import { addDaysStr, fmtInTz, startOfWeekStr } from "@/lib/dates";
import { formatMinutes } from "@/lib/utils";

const MODE_LABEL = { pomodoro: "Pomodoro", custom: "Personalizado", stopwatch: "Progressivo", social_free: "Sem redes" };

export function FocusView({ sessions, habits, today, tz, weekStartsOn }: { sessions: FocusSessionRow[]; habits: HabitRow[]; today: string; tz: string; weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) {
  const [pending, start] = useTransition();
  const totals = focusTotals(sessions, tz, today, weekStartsOn);
  const days7 = focusByDay(sessions, addDaysStr(today, -6), today, tz);
  const days30 = focusByDay(sessions, addDaysStr(today, -29), today, tz);
  const weekStart = startOfWeekStr(today, weekStartsOn);
  const finished = sessions.filter((s) => s.ended_at);

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteFocusSession(id);
      if (!res.ok) toast.error(res.error);
    });

  return (
    <div className="space-y-6">
      <FocusTimer habits={habits} />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Hoje" value={formatMinutes(totals.today)} icon={<Timer />} tone={totals.today > 0 ? "success" : "default"} />
        <Stat label="Esta semana" value={formatMinutes(totals.week)} hint={`desde ${weekStart.split("-").reverse().slice(0, 2).join("/")}`} />
        <Stat label="Este mês" value={formatMinutes(totals.month)} />
        <Stat label="Sem redes (7d)" value={formatMinutes(totals.socialFreeMinutes)} hint={`${totals.completedRate}% das sessões concluídas`} />
      </section>
      <Tabs defaultValue="7">
        <TabsList>
          <TabsTrigger value="7">7 dias</TabsTrigger>
          <TabsTrigger value="30">30 dias</TabsTrigger>
          <TabsTrigger value="hist">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="7">
          <Card><CardHeader><CardTitle>Foco por dia</CardTitle><CardDescription>Minutos medidos pelo cronômetro deste site.</CardDescription></CardHeader><CardContent><FocusBarChart days={days7} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="30">
          <Card><CardHeader><CardTitle>Últimos 30 dias</CardTitle></CardHeader><CardContent><FocusBarChart days={days30} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="hist" className="space-y-2">
          {finished.length === 0 ? <EmptyState icon={<Timer />} title="Nenhuma sessão ainda" description="Inicie um pomodoro ou uma sessão personalizada acima." /> : finished.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
              {s.completed ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <XCircle className="size-4 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.activity}</p>
                <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span>{fmtInTz(s.started_at, "EEE d MMM, HH:mm", tz)}</span>
                  <span>{fmtClock(s.actual_seconds)}{s.planned_minutes ? ` de ${s.planned_minutes} min` : ""}</span>
                  {s.interruptions ? <span>{s.interruptions} interrupç{s.interruptions > 1 ? "ões" : "ão"}</span> : null}
                  {s.goal ? <span className="italic">{s.goal}</span> : null}
                </p>
              </div>
              <Badge variant="muted">{MODE_LABEL[s.mode]}</Badge>
              {s.avoid_social ? <Badge variant="secondary">sem redes</Badge> : null}
              <Button variant="ghost" size="icon-sm" aria-label="Excluir" disabled={pending} onClick={() => remove(s.id)}><Trash2 /></Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
