import type { Metadata } from "next";
import { BarChart3, CheckCircle2, ListChecks, Moon, Smartphone, Timer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { HabitRateChart, SleepTrendChart, WeeklyCompareChart } from "@/components/stats/stats-charts";
import { WeeklySummaryCard } from "@/components/stats/weekly-summary";
import { getUserContext } from "@/lib/context";
import { loadHabits } from "@/lib/data/habits";
import { loadFocusSessions, loadScreenTimeLogs, loadSleepGoal, loadSleepLogs } from "@/lib/data/misc";
import { dailyHabitRate, weekMetrics, weeklySummary } from "@/lib/stats";
import { addDaysStr, dateRange, fmtDate, startOfWeekStr } from "@/lib/dates";
import { sleepMetrics } from "@/lib/sleep";
import { formatMinutes } from "@/lib/utils";

export const metadata: Metadata = { title: "Estatísticas" };

export default async function EstatisticasPage() {
  const ctx = await getUserContext();
  const { today, tz, weekStartsOn } = ctx;
  const since = addDaysStr(today, -90);
  const [habits, sleepLogs, sleepGoal, focus, screen, { data: tasks }] = await Promise.all([
    loadHabits(ctx, { status: ["active", "paused"] }),
    loadSleepLogs(ctx, 90),
    loadSleepGoal(ctx),
    loadFocusSessions(ctx, 90),
    loadScreenTimeLogs(ctx, 90),
    ctx.supabase.from("tasks").select("title,status,completed_at,due_date,postponed_count").eq("user_id", ctx.user.id).or(`completed_at.gte.${since},status.eq.pending`),
  ]);
  const bundles = habits.map((h) => ({ habit: h.habit, schedules: h.schedules, completions: h.completions }));
  const taskList = tasks ?? [];
  const manualScreen = screen.filter((s) => s.source === "manual");

  const summary = weeklySummary({ bundles, tasks: taskList, focus, sleep: sleepLogs, screen: manualScreen, today, tz, weekStartsOn, sleepTargetHours: sleepGoal.target_hours });
  const month = weekMetrics({ bundles, tasks: taskList, focus, sleep: sleepLogs, screen: manualScreen, from: addDaysStr(today, -29), to: today, today, tz });
  const daily30 = dailyHabitRate(bundles, addDaysStr(today, -29), today, today);
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const from = addDaysStr(startOfWeekStr(today, weekStartsOn), -7 * (5 - i));
    const to = i === 5 ? today : addDaysStr(from, 6);
    const m = weekMetrics({ bundles, tasks: taskList, focus, sleep: sleepLogs, screen: manualScreen, from, to, today, tz });
    return { label: fmtDate(from, "d/MM"), habitRate: m.habitRate, focusMinutes: m.focusMinutes, tasksDone: m.tasksDone };
  });
  const sleepByDate = new Map(sleepLogs.map((l) => [l.date, l]));
  const sleepTrend = dateRange(addDaysStr(today, -29), today).map((d) => { const l = sleepByDate.get(d); return { date: d, hours: l ? +(sleepMetrics(l).asleepMin / 60).toFixed(1) : null }; });
  const tasksDoneTotal = taskList.filter((t) => t.status === "done").length;
  const habitEvolution = habits.map((h) => ({ name: h.habit.name, week: h.weekRate, month: h.monthRate, streak: h.streak.current })).sort((a, b) => b.month - a.month);
  const hasData = bundles.length || taskList.length || focus.length || sleepLogs.length || manualScreen.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Estatísticas" description="Evolução real, a partir dos seus registros." />
      {!hasData ? <EmptyState icon={<BarChart3 />} title="Ainda não há dados suficientes" description="Marque hábitos, conclua tarefas e registre sono ou foco. As estatísticas aparecem aqui conforme você usa o app." /> : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Hábitos (30d)" value={`${month.habitRate}%`} hint={`${month.habitDone}/${month.habitScheduled} dias programados`} icon={<ListChecks />} tone={month.habitRate >= 70 ? "success" : "default"} />
            <Stat label="Tarefas concluídas" value={tasksDoneTotal} hint="últimos 90 dias" icon={<CheckCircle2 />} />
            <Stat label="Foco (30d)" value={formatMinutes(month.focusMinutes)} icon={<Timer />} />
            <Stat label="Sono médio (30d)" value={month.sleepAvgMinutes != null ? formatMinutes(month.sleepAvgMinutes) : "—"} hint={`${month.sleepNights} noites registradas`} icon={<Moon />} />
            <Stat label="Tela média (30d)" value={month.screenAvgMinutes != null ? formatMinutes(month.screenAvgMinutes) : "—"} hint={`${month.screenDays} dias informados`} icon={<Smartphone />} />
          </section>

          <WeeklySummaryCard summary={summary} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Taxa de conclusão diária</CardTitle><CardDescription>Hábitos programados concluídos por dia, últimos 30 dias.</CardDescription></CardHeader><CardContent><HabitRateChart data={daily30} /></CardContent></Card>
            <Card><CardHeader><CardTitle>Comparação semanal</CardTitle><CardDescription>Hábitos (%), foco (min) e tarefas nas últimas 6 semanas.</CardDescription></CardHeader><CardContent><WeeklyCompareChart weeks={weeks} /></CardContent></Card>
            <Card><CardHeader><CardTitle>Regularidade do sono</CardTitle><CardDescription>Horas dormidas (estimadas) por noite registrada.</CardDescription></CardHeader><CardContent><SleepTrendChart data={sleepTrend} /></CardContent></Card>
            <Card>
              <CardHeader><CardTitle>Evolução dos hábitos</CardTitle><CardDescription>Semana atual vs. mês. Sequência atual ao lado.</CardDescription></CardHeader>
              <CardContent>
                {habitEvolution.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum hábito.</p> : (
                  <ul className="divide-y divide-border">
                    {habitEvolution.map((h) => (
                      <li key={h.name} className="flex items-center justify-between py-2 text-sm">
                        <span className="truncate">{h.name}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge variant={h.week >= h.month ? "success" : "warning"}>{h.week >= h.month ? "↑" : "↓"} sem {h.week}%</Badge>
                          <span className="text-muted-foreground">mês {h.month}%</span>
                          {h.streak ? <span className="text-success">🔥 {h.streak}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
