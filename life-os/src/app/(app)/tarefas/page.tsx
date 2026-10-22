import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TasksView } from "@/components/tasks/tasks-view";
import { getUserContext } from "@/lib/context";
import { loadTasks } from "@/lib/data/tasks";
import { loadCategories } from "@/lib/data/categories";
import { addDaysStr } from "@/lib/dates";

export const metadata: Metadata = { title: "Tarefas" };

export default async function TarefasPage() {
  const ctx = await getUserContext();
  const [tasks, categories] = await Promise.all([loadTasks(ctx, { includeDone: true }), loadCategories(ctx)]);
  const cutoff = addDaysStr(ctx.today, -60);
  const visible = tasks.filter((t) => t.status !== "done" || (t.completed_at && t.completed_at.slice(0, 10) >= cutoff));
  return (
    <div className="space-y-6">
      <PageHeader title="Tarefas" description="Pendências com prazo, subtarefas e prioridades do dia." />
      <TasksView tasks={visible} categories={categories.filter((c) => c.kind === "task" || c.kind === "general")} today={ctx.today} />
    </div>
  );
}
