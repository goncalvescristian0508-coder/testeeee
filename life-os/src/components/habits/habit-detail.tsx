"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, Flame, MoreHorizontal, Pause, Pencil, Play, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stat } from "@/components/ui/stat";
import { HabitHeatmap } from "./habit-heatmap";
import { HabitFormDialog } from "./habit-form";
import { HabitCheck } from "./habit-check";
import { clearCompletion, deleteHabit, setCompletion, setHabitStatus } from "@/lib/actions/habits";
import { HabitIcon } from "./habit-icon";
import { fmtDate, normalizeTime, WEEKDAY_LABELS } from "@/lib/dates";
import { dayStatus } from "@/lib/habits";
import type { HabitWithState } from "@/lib/data/habits";
import type { CategoryRow } from "@/lib/database.types";

const FREQ_LABEL = { daily: "Todo dia", weekdays: "Dias específicos", times_per_week: "Vezes por semana" };

export function HabitDetail({ item, categories, today }: { item: HabitWithState; categories: CategoryRow[]; today: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dayDialog, setDayDialog] = useState<string | null>(null);
  const [dayValue, setDayValue] = useState("");
  const [pending, start] = useTransition();
  const { habit, streak, weekRate, monthRate, currentSchedule, schedules, completions } = item;

  const status = (s: "active" | "paused" | "archived") =>
    start(async () => {
      const res = await setHabitStatus(habit.id, s);
      if (!res.ok) toast.error(res.error);
      else toast.success(s === "active" ? "Hábito reativado." : s === "paused" ? "Hábito pausado." : "Hábito arquivado.");
    });

  const remove = () =>
    start(async () => {
      const res = await deleteHabit(habit.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Hábito excluído.");
      router.push("/habitos");
    });

  const selected = dayDialog ? completions.find((c) => c.date === dayDialog) : undefined;
  const selectedStatus = dayDialog ? dayStatus(habit, schedules, selected, dayDialog, today) : null;

  const saveDay = (statusToSet: "done" | "skipped" | "clear") => {
    if (!dayDialog) return;
    const date = dayDialog;
    setDayDialog(null);
    start(async () => {
      const res = statusToSet === "clear" ? await clearCompletion(habit.id, date) : await setCompletion({ habitId: habit.id, date, status: statusToSet, value: habit.kind !== "boolean" && dayValue ? Number(dayValue) : null });
      if (!res.ok) toast.error(res.error);
      else toast.success("Registro atualizado.");
    });
  };

  const history = [...completions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: habit.color + "22", color: habit.color }}>
          <HabitIcon name={habit.icon} className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{habit.name}</h1>
            {habit.status !== "active" ? <Badge variant={habit.status === "paused" ? "warning" : "muted"}>{habit.status === "paused" ? "Pausado" : "Arquivado"}</Badge> : null}
          </div>
          {habit.description ? <p className="text-sm text-muted-foreground">{habit.description}</p> : null}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{currentSchedule ? FREQ_LABEL[currentSchedule.frequency] : "Todo dia"}{currentSchedule?.frequency === "weekdays" ? `: ${currentSchedule.weekdays.map((d) => WEEKDAY_LABELS[d]).join(", ")}` : ""}{currentSchedule?.frequency === "times_per_week" ? `: ${currentSchedule.times_per_week}x` : ""}</span>
            {habit.recommended_time ? <span>às {normalizeTime(habit.recommended_time)}</span> : null}
            {habit.target_value != null ? <span>meta {habit.target_value} {habit.unit}</span> : null}
            <span>desde {fmtDate(habit.start_date, "d MMM yyyy")}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {habit.status === "active" ? <HabitCheck habit={habit} date={today} status={item.todayStatus} value={item.todayCompletion?.value} /> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Ações">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEdit(true)}><Pencil /> Editar</DropdownMenuItem>
              {habit.status === "active" ? <DropdownMenuItem onSelect={() => status("paused")}><Pause /> Pausar</DropdownMenuItem> : <DropdownMenuItem onSelect={() => status("active")}><Play /> Reativar</DropdownMenuItem>}
              {habit.status !== "archived" ? <DropdownMenuItem onSelect={() => status("archived")}><Archive /> Arquivar</DropdownMenuItem> : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}><Trash2 /> Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sequência atual" value={`${streak.current} ${streak.current === 1 ? "dia" : "dias"}`} icon={<Flame />} tone={streak.current > 0 ? "success" : "default"} />
        <Stat label="Maior sequência" value={`${streak.longest} ${streak.longest === 1 ? "dia" : "dias"}`} icon={<Trophy />} />
        <Stat label="Esta semana" value={`${weekRate}%`} hint="dias programados concluídos" />
        <Stat label="Este mês" value={`${monthRate}%`} hint="dias programados concluídos" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendário</CardTitle>
          <CardDescription>Toque em um dia para registrar ou corrigir retroativamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <HabitHeatmap habit={habit} schedules={schedules} completions={completions} today={today} color={habit.color} onSelectDay={(d) => { setDayValue(completions.find((c) => c.date === d)?.value?.toString() ?? (habit.target_value?.toString() ?? "")); setDayDialog(d); }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Últimos registros deste hábito.</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{fmtDate(c.date, "EEE, d 'de' MMM")}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {c.value != null ? <span>{c.value} {habit.kind === "duration" ? "min" : habit.unit ?? ""}</span> : null}
                    {c.note ? <span className="max-w-40 truncate italic">“{c.note}”</span> : null}
                    <Badge variant={c.status === "done" ? "success" : "muted"}>{c.status === "done" ? "Feito" : "Justificado"}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <HabitFormDialog open={edit} onOpenChange={setEdit} habit={habit} schedule={currentSchedule} categories={categories} today={today} />

      <Dialog open={!!dayDialog} onOpenChange={(o) => !o && setDayDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dayDialog ? fmtDate(dayDialog, "EEEE, d 'de' MMMM") : ""}</DialogTitle>
            <DialogDescription>
              {selectedStatus === "not_scheduled" ? "Este dia não estava programado, mas você pode registrar mesmo assim." : "Registro retroativo."}
            </DialogDescription>
          </DialogHeader>
          {habit.kind !== "boolean" ? (
            <div className="space-y-2">
              <Label htmlFor="day-value">{habit.kind === "duration" ? "Minutos" : `Quantidade${habit.unit ? ` (${habit.unit})` : ""}`}</Label>
              <Input id="day-value" type="number" min={0} step="any" value={dayValue} onChange={(e) => setDayValue(e.target.value)} />
            </div>
          ) : null}
          <DialogFooter className="sm:flex-col sm:items-stretch">
            <Button variant="success" onClick={() => saveDay("done")} loading={pending}>Marcar como feito</Button>
            <Button variant="secondary" onClick={() => saveDay("skipped")}>Justificar (não conta contra)</Button>
            {selected ? <Button variant="ghost" onClick={() => saveDay("clear")}>Remover registro</Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{habit.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Todo o histórico de conclusões será apagado. Se quiser manter o histórico, arquive em vez de excluir.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
