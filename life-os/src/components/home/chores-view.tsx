"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, ChevronRight, Clock, House, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChoreFormDialog } from "./chore-form";
import { completeChore, deleteChore, setChoreActive, toggleChoreItem } from "@/lib/actions/home";
import { choreState } from "@/lib/home";
import type { ChoreWithItems } from "@/lib/data/home";
import { addDaysStr, dateRange, fmtDate, fmtInTz, relativeDayLabel, startOfWeekStr, WEEKDAY_LONG, weekdayOf } from "@/lib/dates";
import { cn } from "@/lib/utils";

const STATE_LABEL = { overdue: { label: "Atrasada", variant: "destructive" as const }, today: { label: "Hoje", variant: "success" as const }, soon: { label: "Em breve", variant: "warning" as const }, later: { label: "Em dia", variant: "muted" as const } };

export function ChoresView({ chores, today, tz, weekStartsOn }: { chores: ChoreWithItems[]; today: string; tz: string; weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 }) {
  const [open, setOpen] = useState(false);
  const active = chores.filter((c) => c.is_active).sort((a, b) => (a.next_due_date ?? "").localeCompare(b.next_due_date ?? ""));
  const inactive = chores.filter((c) => !c.is_active);
  const overdue = active.filter((c) => choreState(c.next_due_date, today) === "overdue");
  const weekStart = startOfWeekStr(today, weekStartsOn);
  const week = dateRange(weekStart, addDaysStr(weekStart, 6));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{overdue.length ? <span className="text-destructive">{overdue.length} atrasada{overdue.length > 1 ? "s" : ""}</span> : active.length ? "Tudo em dia." : ""}</p>
        <Button onClick={() => setOpen(true)}><Plus /> Nova tarefa</Button>
      </div>
      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="semana">Rotina semanal</TabsTrigger>
          <TabsTrigger value="inativas">Pausadas ({inactive.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="lista" className="space-y-2">
          {active.length === 0 ? <EmptyState icon={<House />} title="Nenhuma tarefa doméstica" description="Cadastre faxinas, roupas, lixo e outras tarefas que não precisam ser diárias." action={<Button onClick={() => setOpen(true)}><Plus /> Criar</Button>} /> : active.map((c) => <ChoreCard key={c.id} chore={c} today={today} tz={tz} />)}
        </TabsContent>
        <TabsContent value="semana">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
            {week.map((d) => {
              const list = active.filter((c) => c.next_due_date === d || (choreState(c.next_due_date, today) === "overdue" && d === today));
              return (
                <div key={d} className={cn("rounded-xl border border-border bg-card p-3", d === today && "border-success/40")}>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{WEEKDAY_LONG[weekdayOf(d)].slice(0, 3)} <span className="text-foreground">{Number(d.slice(8, 10))}</span></p>
                  {list.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Livre</p> : (
                    <ul className="mt-2 space-y-1">
                      {list.map((c) => (
                        <li key={c.id} className={cn("truncate rounded-md bg-muted px-2 py-1 text-xs", choreState(c.next_due_date, today) === "overdue" && "bg-destructive/10 text-destructive")}>{c.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Baseado na última realização e na periodicidade de cada tarefa. Atrasadas aparecem em hoje.</p>
        </TabsContent>
        <TabsContent value="inativas" className="space-y-2">
          {inactive.length === 0 ? <EmptyState title="Nenhuma tarefa pausada" /> : inactive.map((c) => <ChoreCard key={c.id} chore={c} today={today} tz={tz} />)}
        </TabsContent>
      </Tabs>
      <ChoreFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function ChoreCard({ chore, today, tz }: { chore: ChoreWithItems; today: string; tz: string }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  const state = choreState(chore.next_due_date, today);
  const st = STATE_LABEL[state];
  const done = chore.items.filter((i) => i.done).length;
  const total = chore.items.length;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Erro");
      else if (msg) toast.success(msg);
    });

  return (
    <div className={cn("rounded-xl border border-border bg-card", state === "overdue" && chore.is_active && "border-destructive/40", !chore.is_active && "opacity-70")}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button type="button" onClick={() => total && setOpen((o) => !o)} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2 text-sm font-medium">
            {total ? (open ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />) : null}
            <span className="truncate">{chore.name}</span>
            {chore.is_active ? <Badge variant={st.variant}>{st.label}</Badge> : <Badge variant="muted">Pausada</Badge>}
          </span>
          <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>a cada {chore.every_days} dia{chore.every_days > 1 ? "s" : ""}{chore.preferred_weekday != null ? ` · ${WEEKDAY_LONG[chore.preferred_weekday].toLowerCase()}` : ""}</span>
            {chore.next_due_date ? <span>próxima: {relativeDayLabel(chore.next_due_date, today)}</span> : null}
            {chore.last_done_at ? <span>última: {fmtInTz(chore.last_done_at, "d MMM", tz)}</span> : <span>nunca feita</span>}
            {chore.estimated_minutes ? <span className="flex items-center gap-0.5"><Clock className="size-3" />{chore.estimated_minutes} min</span> : null}
            {total ? <span>{done}/{total} etapas</span> : null}
          </span>
        </button>
        {chore.is_active ? (
          <Button size="sm" variant={state === "overdue" || state === "today" ? "success" : "outline"} loading={pending} onClick={() => run(() => completeChore(chore.id, { partial: false }), "Concluída. Próxima data calculada.")}>
            <Check /> Concluir
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Opções"><MoreHorizontal /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEdit(true)}><Pencil /> Editar</DropdownMenuItem>
            {total && done > 0 && done < total ? <DropdownMenuItem onSelect={() => run(() => completeChore(chore.id, { partial: true }), "Conclusão parcial registrada.")}><Check /> Registrar conclusão parcial</DropdownMenuItem> : null}
            <DropdownMenuItem onSelect={() => run(() => setChoreActive(chore.id, !chore.is_active))}>{chore.is_active ? <><Pause /> Pausar</> : <><Play /> Reativar</>}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => run(() => deleteChore(chore.id), "Tarefa excluída.")}><Trash2 /> Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && total ? (
        <div className="space-y-2 border-t border-border px-3 py-2">
          <Progress value={total ? (done / total) * 100 : 0} className="h-1.5" />
          <ul className="space-y-1">
            {chore.items.map((i) => (
              <li key={i.id} className="flex items-center gap-2 text-sm">
                <Checkbox className="size-4" checked={i.done} onCheckedChange={(c) => run(() => toggleChoreItem(i.id, c === true))} aria-label={i.title} />
                <span className={cn(i.done && "line-through text-muted-foreground")}>{i.title}</span>
              </li>
            ))}
          </ul>
          {chore.logs.length ? (
            <p className="text-xs text-muted-foreground">Histórico: {chore.logs.slice(0, 3).map((l) => `${fmtDate(l.done_at.slice(0, 10), "d MMM")}${l.partial ? " (parcial)" : ""}`).join(" · ")}</p>
          ) : null}
        </div>
      ) : null}
      <ChoreFormDialog open={edit} onOpenChange={setEdit} chore={chore} />
    </div>
  );
}
