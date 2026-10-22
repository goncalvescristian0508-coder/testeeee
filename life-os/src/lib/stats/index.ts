/**
 * Estatísticas e resumo semanal por regras determinísticas (sem IA).
 * Todas as funções são puras para facilitar testes.
 */
import { addDaysStr, dateRange, startOfWeekStr, toDateStr } from "@/lib/dates";
import { completionRate, dayStatus, type CompletionLike, type HabitLike, type ScheduleLike } from "@/lib/habits";
import { sleepMetrics, type SleepLogLike } from "@/lib/sleep";

export interface HabitBundle {
  habit: HabitLike & { id: string; name: string };
  schedules: ScheduleLike[];
  completions: CompletionLike[];
}

export interface TaskLike {
  status: string;
  completed_at: string | null;
  due_date: string | null;
  postponed_count: number;
  title: string;
}

export interface FocusLike {
  started_at: string;
  actual_seconds: number;
  completed: boolean;
}

export interface ScreenLike {
  date: string;
  total_minutes: number;
}

export interface WeekMetrics {
  from: string;
  to: string;
  habitRate: number; // 0-100 (média dos dias programados)
  habitScheduled: number;
  habitDone: number;
  tasksDone: number;
  focusMinutes: number;
  sleepAvgMinutes: number | null;
  sleepNights: number;
  screenAvgMinutes: number | null;
  screenDays: number;
}

/** Taxa de conclusão diária agregada (todos os hábitos) por dia. */
export function dailyHabitRate(bundles: HabitBundle[], from: string, to: string, today: string) {
  return dateRange(from, to).map((d) => {
    let scheduled = 0,
      done = 0;
    for (const b of bundles) {
      const comp = b.completions.find((c) => c.date === d);
      const st = dayStatus(b.habit, b.schedules, comp, d, today);
      if (st === "not_scheduled" || st === "skipped") continue;
      if (st === "pending") continue;
      scheduled++;
      if (st === "done") done++;
    }
    return { date: d, scheduled, done, rate: scheduled ? Math.round((done / scheduled) * 100) : null };
  });
}

export function weekMetrics(args: { bundles: HabitBundle[]; tasks: TaskLike[]; focus: FocusLike[]; sleep: SleepLogLike[]; screen: ScreenLike[]; from: string; to: string; today: string; tz: string }): WeekMetrics {
  const { bundles, tasks, focus, sleep, screen, from, to, today, tz } = args;
  let scheduled = 0,
    done = 0;
  for (const b of bundles) {
    const r = completionRate(b.habit, b.schedules, b.completions, from, to, today);
    scheduled += r.scheduled;
    done += r.done;
  }
  const tasksDone = tasks.filter((t) => t.status === "done" && t.completed_at && toDateStr(t.completed_at, tz) >= from && toDateStr(t.completed_at, tz) <= to).length;
  const focusMinutes = Math.round(focus.filter((f) => { const d = toDateStr(f.started_at, tz); return d >= from && d <= to; }).reduce((a, f) => a + f.actual_seconds, 0) / 60);
  const nights = sleep.filter((s) => s.date >= from && s.date <= to);
  const sleepAvg = nights.length ? nights.reduce((a, s) => a + sleepMetrics(s).asleepMin, 0) / nights.length : null;
  const screenDays = screen.filter((s) => s.date >= from && s.date <= to);
  const screenAvg = screenDays.length ? screenDays.reduce((a, s) => a + s.total_minutes, 0) / screenDays.length : null;
  return { from, to, habitRate: scheduled ? Math.round((done / scheduled) * 100) : 0, habitScheduled: scheduled, habitDone: done, tasksDone, focusMinutes, sleepAvgMinutes: sleepAvg, sleepNights: nights.length, screenAvgMinutes: screenAvg, screenDays: screenDays.length };
}

export interface WeeklySummary {
  current: WeekMetrics;
  previous: WeekMetrics;
  improved: string[];
  worsened: string[];
  consistentHabits: { name: string; rate: number }[];
  inconsistentHabits: { name: string; rate: number }[];
  postponed: { title: string; count: number }[];
  suggestion: string;
  trends: { label: string; delta: number; unit: string; positiveIsGood: boolean }[];
}

/** Compara a semana atual (até hoje) com a anterior e gera texto por regras. */
export function weeklySummary(args: { bundles: HabitBundle[]; tasks: TaskLike[]; focus: FocusLike[]; sleep: SleepLogLike[]; screen: ScreenLike[]; today: string; tz: string; weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6; sleepTargetHours?: number }): WeeklySummary {
  const { bundles, tasks, focus, sleep, screen, today, tz, weekStartsOn, sleepTargetHours = 8 } = args;
  const curFrom = startOfWeekStr(today, weekStartsOn);
  const prevFrom = addDaysStr(curFrom, -7);
  const prevTo = addDaysStr(curFrom, -1);
  const current = weekMetrics({ bundles, tasks, focus, sleep, screen, from: curFrom, to: today, today, tz });
  const previous = weekMetrics({ bundles, tasks, focus, sleep, screen, from: prevFrom, to: prevTo, today, tz });

  const improved: string[] = [];
  const worsened: string[] = [];
  const trends: WeeklySummary["trends"] = [];

  const cmp = (label: string, cur: number | null, prev: number | null, unit: string, positiveIsGood: boolean, threshold: number, fmt: (n: number) => string) => {
    if (cur == null || prev == null) return;
    const delta = cur - prev;
    trends.push({ label, delta: Math.round(delta), unit, positiveIsGood });
    if (Math.abs(delta) < threshold) return;
    const good = positiveIsGood ? delta > 0 : delta < 0;
    const text = `${label}: ${fmt(prev)} → ${fmt(cur)}`;
    (good ? improved : worsened).push(text);
  };
  const min = (n: number) => `${Math.round(n)} min`;
  cmp("Hábitos concluídos", current.habitScheduled ? current.habitRate : null, previous.habitScheduled ? previous.habitRate : null, "%", true, 5, (n) => `${n}%`);
  cmp("Tempo de foco", current.focusMinutes, previous.focusMinutes, "min", true, 15, min);
  cmp("Tarefas concluídas", current.tasksDone, previous.tasksDone, "", true, 1, (n) => `${n}`);
  cmp("Sono médio", current.sleepAvgMinutes, previous.sleepAvgMinutes, "min", true, 20, min);
  cmp("Tempo de tela", current.screenAvgMinutes, previous.screenAvgMinutes, "min", false, 15, min);

  const rates = bundles
    .map((b) => ({ name: b.habit.name, ...completionRate(b.habit, b.schedules, b.completions, prevFrom, today, today) }))
    .filter((r) => r.scheduled >= 3);
  const consistentHabits = rates.filter((r) => r.rate >= 80).sort((a, b) => b.rate - a.rate).slice(0, 3).map((r) => ({ name: r.name, rate: r.rate }));
  const inconsistentHabits = rates.filter((r) => r.rate < 50).sort((a, b) => a.rate - b.rate).slice(0, 3).map((r) => ({ name: r.name, rate: r.rate }));

  const postponed = tasks
    .filter((t) => t.postponed_count >= 2 && t.status !== "done")
    .sort((a, b) => b.postponed_count - a.postponed_count)
    .slice(0, 3)
    .map((t) => ({ title: t.title, count: t.postponed_count }));

  // Sugestão única, pela regra de maior impacto.
  let suggestion: string;
  if (inconsistentHabits.length) suggestion = `Escolha só um hábito para recuperar na próxima semana: “${inconsistentHabits[0].name}”. Reduza a meta ao mínimo (dois minutos contam) e marque todo dia.`;
  else if (postponed.length) suggestion = `“${postponed[0].title}” foi adiada ${postponed[0].count} vezes. Quebre em uma subtarefa de 15 minutos e agende um bloco na agenda.`;
  else if (current.sleepNights >= 3 && current.sleepAvgMinutes != null && current.sleepAvgMinutes < sleepTargetHours * 60 - 30) suggestion = `Você dormiu em média ${Math.round(current.sleepAvgMinutes / 60 * 10) / 10}h, abaixo da meta. Comece a rotina noturna 30 minutos mais cedo.`;
  else if (current.screenAvgMinutes != null && previous.screenAvgMinutes != null && current.screenAvgMinutes > previous.screenAvgMinutes + 15) suggestion = "O tempo de tela subiu. Experimente uma sessão “sem redes sociais” de 1 hora por dia na página de foco.";
  else if (current.focusMinutes < previous.focusMinutes - 30) suggestion = "O tempo de foco caiu. Agende dois pomodoros fixos no mesmo horário todos os dias.";
  else if (current.habitScheduled === 0 && bundles.length === 0) suggestion = "Comece criando dois ou três hábitos pequenos. Constância vem antes de volume.";
  else if (current.habitRate >= 80) suggestion = "Semana sólida. Mantenha o mesmo plano; não adicione hábitos novos ainda.";
  else suggestion = "Revise os horários dos hábitos que ficaram pendentes: um horário realista vale mais que uma meta ambiciosa.";

  return { current, previous, improved, worsened, consistentHabits, inconsistentHabits, postponed, suggestion, trends };
}
