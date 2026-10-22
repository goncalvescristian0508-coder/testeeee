"use client";

import { useState, useTransition } from "react";
import { Archive, CheckCircle2, Minus, MoreHorizontal, Pencil, Plus, Target, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GoalFormDialog } from "./goal-form";
import { addGoalProgress, deleteGoal, setGoalStatus } from "@/lib/actions/goals";
import type { GoalWithHistory } from "@/lib/data/goals";
import type { HabitRow } from "@/lib/database.types";
import { diffDays, fmtDate, fmtInTz } from "@/lib/dates";
import { cn, pct } from "@/lib/utils";

export function GoalsView({ goals, habits, habitRates, today, tz }: { goals: GoalWithHistory[]; habits: HabitRow[]; habitRates: Record<string, number>; today: string; tz: string }) {
  const [open, setOpen] = useState(false);
  const active = goals.filter((g) => g.status === "active");
  const completed = goals.filter((g) => g.status === "completed");
  const archived = goals.filter((g) => g.status === "archived");
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus /> Nova meta</Button></div>
      <Tabs defaultValue="ativas">
        <TabsList>
          <TabsTrigger value="ativas">Ativas ({active.length})</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas ({completed.length})</TabsTrigger>
          <TabsTrigger value="arquivadas">Arquivadas ({archived.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="ativas" className="grid gap-3 md:grid-cols-2">
          {active.length === 0 ? <EmptyState className="md:col-span-2" icon={<Target />} title="Nenhuma meta ativa" description="Defina algo concreto: ler um livro, 30 dias arrumando a cama, reduzir redes sociais." action={<Button onClick={() => setOpen(true)}><Plus /> Criar meta</Button>} /> : active.map((g) => <GoalCard key={g.id} goal={g} habits={habits} habitRates={habitRates} today={today} tz={tz} />)}
        </TabsContent>
        <TabsContent value="concluidas" className="grid gap-3 md:grid-cols-2">{completed.length === 0 ? <EmptyState className="md:col-span-2" title="Nenhuma meta concluída ainda" /> : completed.map((g) => <GoalCard key={g.id} goal={g} habits={habits} habitRates={habitRates} today={today} tz={tz} />)}</TabsContent>
        <TabsContent value="arquivadas" className="grid gap-3 md:grid-cols-2">{archived.length === 0 ? <EmptyState className="md:col-span-2" title="Nada arquivado" /> : archived.map((g) => <GoalCard key={g.id} goal={g} habits={habits} habitRates={habitRates} today={today} tz={tz} />)}</TabsContent>
      </Tabs>
      <GoalFormDialog open={open} onOpenChange={setOpen} habits={habits} today={today} />
    </div>
  );
}

function GoalCard({ goal, habits, habitRates, today, tz }: { goal: GoalWithHistory; habits: HabitRow[]; habitRates: Record<string, number>; today: string; tz: string }) {
  const [edit, setEdit] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const target = Number(goal.target_value ?? 0);
  const current = Number(goal.current_value);
  const percent = goal.kind === "numeric" ? Math.min(100, pct(current, target)) : goal.status === "completed" ? 100 : 0;
  const daysLeft = goal.deadline ? diffDays(goal.deadline, today) : null;
  const related = habits.filter((h) => goal.related_habit_ids.includes(h.id));

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Erro");
      else if (msg) toast.success(msg);
    });

  const saveProgress = (mode: "add" | "set") => {
    const v = Number(value);
    if (!Number.isFinite(v)) return toast.error("Informe um número.");
    setProgressOpen(false);
    run(() => addGoalProgress(goal.id, mode === "add" ? { delta: v, note } : { value: v, note }), "Progresso registrado.");
    setValue("");
    setNote("");
  };

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", goal.status === "completed" && "border-success/40", goal.status === "archived" && "opacity-70")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium leading-tight">{goal.name}</h3>
          {goal.description ? <p className="mt-0.5 text-sm text-muted-foreground">{goal.description}</p> : null}
          <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            <span>desde {fmtDate(goal.start_date, "d MMM")}</span>
            {goal.deadline ? <span className={cn(daysLeft != null && daysLeft < 0 && goal.status === "active" && "text-destructive")}>{daysLeft != null && daysLeft < 0 ? `prazo venceu há ${-daysLeft} dia${-daysLeft > 1 ? "s" : ""}` : daysLeft === 0 ? "prazo hoje" : `${daysLeft} dias restantes`}</span> : null}
          </div>
        </div>
        {goal.status === "completed" ? <Badge variant="success"><CheckCircle2 /> Concluída</Badge> : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Opções"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEdit(true)}><Pencil /> Editar</DropdownMenuItem>
            {goal.status === "active" ? <DropdownMenuItem onSelect={() => run(() => setGoalStatus(goal.id, "completed"), "Meta concluída. Parabéns.")}><CheckCircle2 /> Marcar como concluída</DropdownMenuItem> : <DropdownMenuItem onSelect={() => run(() => setGoalStatus(goal.id, "active"))}><Undo2 /> Reativar</DropdownMenuItem>}
            {goal.status !== "archived" ? <DropdownMenuItem onSelect={() => run(() => setGoalStatus(goal.id, "archived"))}><Archive /> Arquivar</DropdownMenuItem> : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => run(() => deleteGoal(goal.id), "Meta excluída.")}><Trash2 /> Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {goal.kind === "numeric" ? (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm"><span className="font-semibold tabular-nums">{current} <span className="font-normal text-muted-foreground">/ {target} {goal.unit}</span></span><span className="text-muted-foreground">{percent}%</span></div>
          <Progress value={percent} />
        </div>
      ) : null}
      {related.length ? (
        <div className="flex flex-wrap gap-1.5">
          {related.map((h) => <Badge key={h.id} variant={(habitRates[h.id] ?? 0) >= 70 ? "success" : "muted"}>{h.name} · {habitRates[h.id] ?? 0}%</Badge>)}
        </div>
      ) : null}
      {goal.status === "active" && goal.kind === "numeric" ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => run(() => addGoalProgress(goal.id, { delta: 1 }))} disabled={pending}><Plus /> 1</Button>
          <Button size="sm" variant="outline" onClick={() => run(() => addGoalProgress(goal.id, { delta: -1 }))} disabled={pending || current <= 0}><Minus /> 1</Button>
          <Button size="sm" variant="secondary" onClick={() => setProgressOpen(true)}>Registrar progresso</Button>
        </div>
      ) : null}
      {goal.history.length ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Histórico ({goal.history.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {goal.history.slice(0, 8).map((h) => (
              <li key={h.id}>{fmtInTz(h.created_at, "d MMM HH:mm", tz)} · {h.delta > 0 ? `+${h.delta}` : h.delta < 0 ? h.delta : ""}{h.delta !== 0 ? ` → ${h.value_after}` : ""}{h.note ? ` · ${h.note}` : ""}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <GoalFormDialog open={edit} onOpenChange={setEdit} goal={goal} habits={habits} today={today} />
      <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Registrar progresso</DialogTitle><DialogDescription>{goal.name} · atual {current} {goal.unit}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2"><Label htmlFor={`gp-${goal.id}`}>Valor</Label><Input id={`gp-${goal.id}`} type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} autoFocus /></div>
            <div className="space-y-2"><Label htmlFor={`gn-${goal.id}`}>Nota (opcional)</Label><Input id={`gn-${goal.id}`} value={note} onChange={(e) => setNote(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => saveProgress("set")}>Definir como total</Button>
            <Button onClick={() => saveProgress("add")}>Somar ao atual</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
