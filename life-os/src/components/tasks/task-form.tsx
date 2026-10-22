"use client";

import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createTask, updateTask, taskSchema, type TaskInput } from "@/lib/actions/tasks";
import type { CategoryRow } from "@/lib/database.types";
import type { TaskWithSubtasks } from "@/lib/data/tasks";

type FormValues = z.input<typeof taskSchema>;

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskWithSubtasks | null;
  categories: CategoryRow[];
  today: string;
  defaultDate?: string | null;
  defaultPeriod?: "morning" | "afternoon" | "evening" | null;
}

export function TaskFormDialog({ open, onOpenChange, task, categories, today, defaultDate, defaultPeriod }: TaskFormProps) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaults: FormValues = task
    ? {
        title: task.title,
        description: task.description ?? "",
        due_date: task.due_date ?? "",
        due_time: task.due_time?.slice(0, 5) ?? "",
        period: task.period ?? "",
        priority: task.priority,
        category_id: task.category_id,
        estimated_minutes: task.estimated_minutes,
        is_priority: task.is_priority,
        subtasks: task.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done })),
      }
    : { title: "", description: "", due_date: defaultDate ?? today, due_time: "", period: defaultPeriod ?? "", priority: 2, category_id: null, estimated_minutes: null, is_priority: false, subtasks: [] };

  const form = useForm<FormValues>({ resolver: zodResolver(taskSchema), defaultValues: defaults, values: defaults });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "subtasks" });

  const submit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = task ? await updateTask(task.id, values as TaskInput) : await createTask(values as TaskInput);
      if (!res.ok) return setError(res.error);
      toast.success(task ? "Tarefa atualizada." : "Tarefa criada.");
      form.reset();
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription>Tarefas com prazo aparecem na agenda e na timeline do dia.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="t-title">Título</Label>
            <Input id="t-title" autoFocus placeholder="Ex.: Resolver pendências financeiras" {...form.register("title")} aria-invalid={!!form.formState.errors.title} />
            {form.formState.errors.title ? <p className="text-xs text-destructive">{form.formState.errors.title.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-desc">Descrição</Label>
            <Textarea id="t-desc" rows={2} {...form.register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-date">Data</Label>
              <Input id="t-date" type="date" {...form.register("due_date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-time">Hora (opcional)</Label>
              <Input id="t-time" type="time" {...form.register("due_time")} />
            </div>
            <div className="space-y-2">
              <Label>Período</Label>
              <Controller
                control={form.control}
                name="period"
                render={({ field }) => (
                  <Select value={field.value || "auto"} onValueChange={(v) => field.onChange(v === "auto" ? "" : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático</SelectItem>
                      <SelectItem value="morning">Manhã</SelectItem>
                      <SelectItem value="afternoon">Tarde</SelectItem>
                      <SelectItem value="evening">Noite</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Alta</SelectItem>
                      <SelectItem value="2">Média</SelectItem>
                      <SelectItem value="3">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Controller
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-est">Duração (min)</Label>
              <Input id="t-est" type="number" min={0} inputMode="numeric" {...form.register("estimated_minutes")} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Subtarefas</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => append({ title: "", done: false })}>
                <Plus /> Adicionar
              </Button>
            </div>
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2">
                <Input placeholder={`Etapa ${i + 1}`} {...form.register(`subtasks.${i}.title` as const)} />
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover" onClick={() => remove(i)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Prioridade do dia</p>
              <p className="text-xs text-muted-foreground">Destaca a tarefa no dashboard.</p>
            </div>
            <Controller control={form.control} name="is_priority" render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} />} />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={pending}>{task ? "Salvar" : "Criar tarefa"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
