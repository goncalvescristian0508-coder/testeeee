"use client";

import { useOptimistic, useState, useTransition } from "react";
import { CalendarClock, ChevronDown, ChevronRight, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { deleteTask, postponeTask, setTaskPriority, toggleSubtask, toggleTask } from "@/lib/actions/tasks";
import { TaskFormDialog } from "./task-form";
import type { TaskWithSubtasks } from "@/lib/data/tasks";
import type { CategoryRow } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { normalizeTime, relativeDayLabel } from "@/lib/dates";

interface TaskItemProps {
  task: TaskWithSubtasks;
  today: string;
  categories: CategoryRow[];
  showDate?: boolean;
  compact?: boolean;
}

export function TaskItem({ task, today, categories, showDate, compact }: TaskItemProps) {
  const [pending, start] = useTransition();
  const [done, setDone] = useOptimistic(task.status === "done");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const overdue = !done && task.due_date && task.due_date < today;
  const subsDone = task.subtasks.filter((s) => s.done).length;

  const toggle = (checked: boolean) =>
    start(async () => {
      setDone(checked);
      const res = await toggleTask(task.id, checked);
      if (!res.ok) toast.error(res.error);
    });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Erro");
      else if (msg) toast.success(msg);
    });

  return (
    <div className={cn("rounded-xl border border-border bg-card transition-colors", done && "opacity-60", overdue && "border-destructive/40")}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Checkbox checked={done} onCheckedChange={(c) => toggle(c === true)} disabled={pending} aria-label={done ? `Reabrir ${task.title}` : `Concluir ${task.title}`} />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => task.subtasks.length && setOpen((o) => !o)}>
          <span className={cn("flex items-center gap-1.5 text-sm font-medium", done && "line-through text-muted-foreground")}>
            {task.is_priority && !done ? <Star className="size-3.5 shrink-0 fill-warning text-warning" /> : null}
            <span className="truncate">{task.title}</span>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {showDate && task.due_date ? <span className={cn(overdue && "text-destructive font-medium")}>{relativeDayLabel(task.due_date, today)}</span> : overdue ? <span className="font-medium text-destructive">Atrasada</span> : null}
            {task.due_time ? <span>{normalizeTime(task.due_time)}</span> : null}
            {task.estimated_minutes ? <span>{task.estimated_minutes} min</span> : null}
            {task.subtasks.length ? (
              <span className="flex items-center gap-0.5">
                {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                {subsDone}/{task.subtasks.length}
              </span>
            ) : null}
            {task.postponed_count > 1 ? <Badge variant="warning" className="px-1.5 py-0">adiada {task.postponed_count}x</Badge> : null}
          </span>
        </button>
        {!compact ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Opções da tarefa"><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEdit(true)}><Pencil /> Editar</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => run(() => setTaskPriority(task.id, !task.is_priority))}><Star /> {task.is_priority ? "Remover das prioridades" : "Marcar como prioridade"}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => run(() => postponeTask(task.id, 1), "Adiada para amanhã.")}><CalendarClock /> Adiar para amanhã</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => run(() => deleteTask(task.id), "Tarefa excluída.")}><Trash2 /> Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {open && task.subtasks.length ? (
        <ul className="space-y-1 border-t border-border px-3 py-2 pl-11">
          {task.subtasks.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <Checkbox className="size-4" checked={s.done} onCheckedChange={(c) => run(() => toggleSubtask(s.id, c === true))} aria-label={s.title} />
              <span className={cn(s.done && "line-through text-muted-foreground")}>{s.title}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <TaskFormDialog open={edit} onOpenChange={setEdit} task={task} categories={categories} today={today} />
    </div>
  );
}
