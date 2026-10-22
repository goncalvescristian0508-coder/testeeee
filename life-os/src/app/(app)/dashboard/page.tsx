import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertCircle, ArrowRight, BedDouble, CalendarClock, CheckCircle2, Flame, ListChecks, Moon, Smartphone, Star, Sunrise, Timer } from "lucide-react";
import { getUserContext } from "@/lib/context";
import { loadDashboard } from "@/lib/data/dashboard";
import { loadCategories } from "@/lib/data/categories";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Timeline } from "@/components/dashboard/timeline";
import { HabitRowItem } from "@/components/habits/habit-row";
import { TaskItem } from "@/components/tasks/task-item";
import { Stat } from "@/components/ui/stat";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { fmtDate, greetingFor, hourInTz, normalizeTime, nowTimeStr, timeToMinutes, toTimeStr } from "@/lib/dates";
import { encouragement } from "@/lib/habits";
import { formatMinutes } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

const STATUS = {
  on_track: { label: "Dentro do planejado", icon: CheckCircle2, cls: "text-success bg-success/10 border-success/30" },
  pending: { label: "Pendências em aberto", icon: AlertCircle, cls: "text-destructive bg-destructive/10 border-destructive/30" },
  complete: { label: "Rotina concluída", icon: Star, cls: "text-success bg-success/15 border-success/40" },
  empty: { label: "Dia sem planejamento", icon: Sunrise, cls: "text-muted-foreground bg-muted border-border" },
};

export default async function DashboardPage() {
  const ctx = await getUserContext();
  if (!ctx.profile.onboarding_completed) redirect("/onboarding");
  const [data, categories] = await Promise.all([loadDashboard(ctx), loadCategories(ctx)]);
  const { tz, today, periods } = ctx;
  const now = new Date();
  const hour = hourInTz(now, tz);
  const name = ctx.profile.display_name?.split(" ")[0] ?? "";
  const scheduled = data.habits.filter((h) => h.todayStatus !== "not_scheduled");
  const habitsDone = scheduled.filter((h) => h.todayStatus === "done" || h.todayStatus === "skipped").length;
  const habitPct = scheduled.length ? Math.round((habitsDone / scheduled.length) * 100) : 0;
  const pendingTasks = data.tasks.filter((t) => t.status === "pending");
  const doneTasks = data.tasks.filter((t) => t.status === "done").length;
  const priorities = pendingTasks.filter((t) => t.is_priority).slice(0, 5);
  const status = STATUS[data.dayStatus];
  const avgWeek = data.habits.length ? Math.round(data.habits.reduce((a, h) => a + h.weekRate, 0) / data.habits.length) : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm capitalize text-muted-foreground">{fmtDate(today, "EEEE, d 'de' MMMM")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {greetingFor(hour)}
            {name ? `, ${name}` : ""}.
          </h1>
          <div className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", status.cls)}>
            <status.icon className="size-3.5" />
            {status.label}
          </div>
        </div>
        <QuickActions categories={categories} today={today} tz={tz} />
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Hábitos de hoje" value={`${habitsDone}/${scheduled.length}`} hint={<Progress value={habitPct} className="mt-1 h-1.5" />} icon={<ListChecks />} />
        <Stat label="Tarefas" value={`${doneTasks}/${doneTasks + pendingTasks.length}`} hint={pendingTasks.some((t) => t.due_date && t.due_date < today) ? <span className="text-destructive">há tarefas atrasadas</span> : "concluídas hoje"} icon={<CheckCircle2 />} />
        <Stat label="Constância" value={`${data.constancyStreak} ${data.constancyStreak === 1 ? "dia" : "dias"}`} hint="dias seguidos com a rotina em dia" icon={<Flame />} tone={data.constancyStreak > 0 ? "success" : "default"} />
        <Stat
          label="Próximo compromisso"
          value={data.nextOccurrence ? <span className="text-lg leading-tight">{data.nextOccurrence.source.title}</span> : <span className="text-lg text-muted-foreground">Nenhum</span>}
          hint={data.nextOccurrence ? `${fmtDate(data.nextOccurrence.start_at.slice(0, 10) === today ? today : data.nextOccurrence.start_at.slice(0, 10), "EEE d MMM")} · ${normalizeTime(toTimeStr(data.nextOccurrence.start_at, tz))}` : "nos próximos 14 dias"}
          icon={<CalendarClock />}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Dormir" value={normalizeTime(data.sleepGoal.bedtime)} hint="horário planejado" icon={<Moon />} />
        <Stat label="Acordar" value={normalizeTime(data.sleepGoal.wake_time)} hint="horário planejado" icon={<Sunrise />} />
        <Stat label="Último sono" value={data.lastSleepMinutes != null ? formatMinutes(data.lastSleepMinutes) : "—"} hint={data.lastSleep ? `registrado · ${fmtDate(data.lastSleep.date, "d MMM")}` : "sem registro manual"} icon={<BedDouble />} />
        <Stat label="Foco hoje" value={formatMinutes(data.focusTodayMinutes)} hint="medido no site" icon={<Timer />} tone={data.focusTodayMinutes > 0 ? "success" : "default"} />
        <Stat label="Tela hoje" value={data.screenTodayMinutes != null ? formatMinutes(data.screenTodayMinutes) : "—"} hint={data.screenTodayMinutes != null ? "informado por você" : "não informado"} icon={<Smartphone />} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Timeline do dia</h2>
          <span className="text-xs text-muted-foreground">{nowTimeStr(tz, now)}</span>
        </div>
        <Timeline tasks={data.tasks} habits={data.habits} occurrences={data.todayOccurrences} categories={categories} today={today} tz={tz} periods={periods} nowMinutes={timeToMinutes(nowTimeStr(tz, now))} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Prioridades do dia</h2>
            <Button asChild variant="ghost" size="sm"><Link href="/tarefas">Todas <ArrowRight /></Link></Button>
          </div>
          {priorities.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Nenhuma prioridade marcada. Escolha até três tarefas que realmente importam hoje.</p>
          ) : (
            <div className="space-y-2">{priorities.map((t) => <TaskItem key={t.id} task={t} today={today} categories={categories} />)}</div>
          )}
          {data.overdueChores.length ? (
            <Link href="/casa" className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4" /> {data.overdueChores.length} tarefa{data.overdueChores.length > 1 ? "s" : ""} doméstica{data.overdueChores.length > 1 ? "s" : ""} atrasada{data.overdueChores.length > 1 ? "s" : ""}
            </Link>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Hábitos</h2>
            <Button asChild variant="ghost" size="sm"><Link href="/habitos">Ver todos <ArrowRight /></Link></Button>
          </div>
          {scheduled.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Nenhum hábito programado para hoje.</p>
          ) : (
            <div className="space-y-2">{scheduled.map((h) => <HabitRowItem key={h.habit.id} item={h} today={today} compact />)}</div>
          )}
          <p className="text-xs text-muted-foreground">{encouragement(avgWeek, data.constancyStreak)}</p>
        </section>
      </div>
    </div>
  );
}
