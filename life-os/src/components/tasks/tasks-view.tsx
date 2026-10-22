"use client";

import { useState } from "react";
import { CheckSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskFormDialog } from "./task-form";
import { TaskItem } from "./task-item";
import type { TaskWithSubtasks } from "@/lib/data/tasks";
import type { CategoryRow } from "@/lib/database.types";
import { addDaysStr } from "@/lib/dates";

export function TasksView({ tasks, categories, today }: { tasks: TaskWithSubtasks[]; categories: CategoryRow[]; today: string }) {
  const [open, setOpen] = useState(false);
  const pending = tasks.filter((t) => t.status === "pending");
  const overdue = pending.filter((t) => t.due_date && t.due_date < today);
  const todayList = pending.filter((t) => t.due_date === today);
  const week = pending.filter((t) => t.due_date && t.due_date > today && t.due_date <= addDaysStr(today, 7));
  const later = pending.filter((t) => (t.due_date && t.due_date > addDaysStr(today, 7)) || !t.due_date);
  const done = tasks.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));

  const section = (title: string, list: TaskWithSubtasks[], tone?: "destructive") =>
    list.length ? (
      <section className="space-y-2">
        <h2 className={`text-xs font-medium uppercase tracking-wider ${tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`}>
          {title} · {list.length}
        </h2>
        {list.map((t) => (
          <TaskItem key={t.id} task={t} today={today} categories={categories} showDate />
        ))}
      </section>
    ) : null;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus /> Nova tarefa</Button>
      </div>
      <Tabs defaultValue="abertas">
        <TabsList>
          <TabsTrigger value="abertas">Abertas ({pending.length})</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas ({done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="abertas" className="space-y-6">
          {pending.length === 0 ? (
            <EmptyState icon={<CheckSquare />} title="Nenhuma tarefa aberta" description="Adicione tarefas com prazo para vê-las na agenda e na timeline do dia." action={<Button onClick={() => setOpen(true)}><Plus /> Nova tarefa</Button>} />
          ) : (
            <>
              {section("Atrasadas", overdue, "destructive")}
              {section("Hoje", todayList)}
              {section("Próximos 7 dias", week)}
              {section("Mais tarde / sem data", later)}
            </>
          )}
        </TabsContent>
        <TabsContent value="concluidas" className="space-y-2">
          {done.length === 0 ? <EmptyState title="Nada concluído ainda" description="As tarefas finalizadas ficam aqui por 60 dias." /> : done.map((t) => <TaskItem key={t.id} task={t} today={today} categories={categories} showDate />)}
        </TabsContent>
      </Tabs>
      <TaskFormDialog open={open} onOpenChange={setOpen} categories={categories} today={today} />
    </div>
  );
}
