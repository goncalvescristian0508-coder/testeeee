"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, GripVertical, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { HabitFormDialog } from "./habit-form";
import { HabitRowItem } from "./habit-row";
import { reorderHabits } from "@/lib/actions/habits";
import { encouragement } from "@/lib/habits";
import type { HabitWithState } from "@/lib/data/habits";
import type { CategoryRow } from "@/lib/database.types";
import { PERIOD_LABEL, periodOfTime, type DayPeriods } from "@/lib/dates";

interface Props {
  items: HabitWithState[];
  categories: CategoryRow[];
  today: string;
  periods: DayPeriods;
}

export function HabitsView({ items, categories, today, periods }: Props) {
  const [open, setOpen] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [order, setOrder] = useState<string[] | null>(null);
  const [pending, start] = useTransition();

  const active = items.filter((i) => i.habit.status === "active");
  const inactive = items.filter((i) => i.habit.status !== "active");
  const scheduledToday = active.filter((i) => i.todayStatus !== "not_scheduled");
  const doneToday = scheduledToday.filter((i) => i.todayStatus === "done" || i.todayStatus === "skipped").length;
  const progress = scheduledToday.length ? Math.round((doneToday / scheduledToday.length) * 100) : 0;
  const avgWeek = active.length ? Math.round(active.reduce((a, i) => a + i.weekRate, 0) / active.length) : 0;
  const bestStreak = Math.max(0, ...active.map((i) => i.streak.current));

  const activeMap = new Map(active.map((i) => [i.habit.id, i]));
  const ordered = order ? order.map((id) => activeMap.get(id)).filter((i): i is HabitWithState => !!i) : active;

  const byPeriod: Record<"morning" | "afternoon" | "evening" | "any", HabitWithState[]> = { morning: [], afternoon: [], evening: [], any: [] };
  for (const i of scheduledToday) {
    const p = i.habit.period ?? (i.habit.recommended_time ? periodOfTime(i.habit.recommended_time, periods) : null);
    byPeriod[p ?? "any"].push(i);
  }

  const move = (id: string, dir: -1 | 1) => {
    const ids = (order ?? active.map((i) => i.habit.id)).slice();
    const idx = ids.indexOf(id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= ids.length) return;
    [ids[idx], ids[to]] = [ids[to], ids[idx]];
    setOrder(ids);
  };

  const saveOrder = () => {
    if (!order) return setReorder(false);
    start(async () => {
      const res = await reorderHabits(order);
      if (!res.ok) toast.error(res.error);
      else toast.success("Ordem salva.");
      setReorder(false);
      setOrder(null);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {reorder ? (
            <>
              <Button variant="ghost" onClick={() => { setReorder(false); setOrder(null); }}>Cancelar</Button>
              <Button onClick={saveOrder} loading={pending}>Salvar ordem</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setReorder(true)} disabled={active.length < 2}>
              <GripVertical /> Reorganizar
            </Button>
          )}
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus /> Novo hábito
        </Button>
      </div>

      {active.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Hoje</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {doneToday}/{scheduledToday.length}
            </p>
            <Progress value={progress} className="mt-2" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Média da semana</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{avgWeek}%</p>
            <p className="mt-1 text-xs text-muted-foreground">{encouragement(avgWeek, bestStreak)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Maior sequência ativa</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{bestStreak} {bestStreak === 1 ? "dia" : "dias"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Dias não programados não quebram a sequência.</p>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="hoje">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="todos">Todos ({active.length})</TabsTrigger>
          <TabsTrigger value="inativos">Pausados/Arquivados ({inactive.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="space-y-5">
          {scheduledToday.length === 0 ? (
            <EmptyState icon={<ListChecks />} title={active.length ? "Nenhum hábito programado para hoje" : "Nenhum hábito ainda"} description={active.length ? "Aproveite para descansar ou revisar suas metas." : "Crie seu primeiro hábito. Comece pequeno: uma ação de dois minutos já conta."} action={!active.length ? <Button onClick={() => setOpen(true)}><Plus /> Criar hábito</Button> : undefined} />
          ) : (
            (["morning", "afternoon", "evening", "any"] as const).map((p) =>
              byPeriod[p].length ? (
                <section key={p} className="space-y-2">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{p === "any" ? "A qualquer hora" : PERIOD_LABEL[p]}</h2>
                  <div className="space-y-2">
                    {byPeriod[p].map((i) => (
                      <HabitRowItem key={i.habit.id} item={i} today={today} />
                    ))}
                  </div>
                </section>
              ) : null,
            )
          )}
        </TabsContent>

        <TabsContent value="todos" className="space-y-2">
          {ordered.length === 0 ? (
            <EmptyState icon={<ListChecks />} title="Nenhum hábito ativo" action={<Button onClick={() => setOpen(true)}><Plus /> Criar hábito</Button>} />
          ) : (
            ordered.map((i, idx) => (
              <HabitRowItem
                key={i.habit.id}
                item={i}
                today={today}
                dragHandle={
                  reorder ? (
                    <div className="flex flex-col">
                      <button type="button" aria-label="Mover para cima" disabled={idx === 0} onClick={() => move(i.habit.id, -1)} className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="size-4" /></button>
                      <button type="button" aria-label="Mover para baixo" disabled={idx === ordered.length - 1} onClick={() => move(i.habit.id, 1)} className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="size-4" /></button>
                    </div>
                  ) : undefined
                }
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="inativos" className="space-y-2">
          {inactive.length === 0 ? <EmptyState title="Nada por aqui" description="Hábitos pausados ou arquivados aparecerão nesta lista." /> : inactive.map((i) => <HabitRowItem key={i.habit.id} item={i} today={today} compact />)}
        </TabsContent>
      </Tabs>

      <HabitFormDialog open={open} onOpenChange={setOpen} categories={categories} today={today} />
    </div>
  );
}
