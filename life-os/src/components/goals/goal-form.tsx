"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createGoal, updateGoal, goalSchema, type GoalInput } from "@/lib/actions/goals";
import type { HabitRow, PersonalGoalRow } from "@/lib/database.types";

type FormValues = z.input<typeof goalSchema>;

const EXAMPLES = [
  { name: "Ler um livro", kind: "numeric" as const, target: 300, unit: "páginas" },
  { name: "Completar 30 dias arrumando a cama", kind: "numeric" as const, target: 30, unit: "dias" },
  { name: "Dormir consistentemente por 2 semanas", kind: "numeric" as const, target: 14, unit: "noites" },
  { name: "Diminuir tempo em redes sociais", kind: "completion" as const },
  { name: "Manter o quarto organizado", kind: "completion" as const },
];

export function GoalFormDialog({ open, onOpenChange, goal, habits, today }: { open: boolean; onOpenChange: (o: boolean) => void; goal?: PersonalGoalRow | null; habits: HabitRow[]; today: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaults: FormValues = goal
    ? { name: goal.name, description: goal.description ?? "", kind: goal.kind, target_value: goal.target_value, unit: goal.unit ?? "", start_date: goal.start_date, deadline: goal.deadline ?? "", related_habit_ids: goal.related_habit_ids }
    : { name: "", description: "", kind: "numeric", target_value: null, unit: "", start_date: today, deadline: "", related_habit_ids: [] };
  const form = useForm<FormValues>({ resolver: zodResolver(goalSchema), defaultValues: defaults, values: defaults });
  const kind = form.watch("kind");

  const submit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = goal ? await updateGoal(goal.id, values as GoalInput) : await createGoal(values as GoalInput);
      if (!res.ok) return setError(res.error);
      toast.success(goal ? "Meta atualizada." : "Meta criada.");
      form.reset();
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{goal ? "Editar meta" : "Nova meta"}</DialogTitle><DialogDescription>Metas numéricas têm progresso; metas de conclusão são marcadas quando alcançadas.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {!goal ? (
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((e) => (
                <button key={e.name} type="button" onClick={() => { form.setValue("name", e.name); form.setValue("kind", e.kind); form.setValue("target_value", "target" in e ? e.target ?? null : null); form.setValue("unit", "unit" in e ? e.unit ?? "" : ""); }} className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent">{e.name}</button>
              ))}
            </div>
          ) : null}
          <div className="space-y-2"><Label htmlFor="g-name">Nome</Label><Input id="g-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />{form.formState.errors.name ? <p className="text-xs text-destructive">{form.formState.errors.name.message}</p> : null}</div>
          <div className="space-y-2"><Label htmlFor="g-desc">Descrição</Label><Textarea id="g-desc" rows={2} {...form.register("description")} /></div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Controller control={form.control} name="kind" render={({ field }) => (
              <ToggleGroup type="single" value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                <ToggleGroupItem value="numeric">Numérica</ToggleGroupItem>
                <ToggleGroupItem value="completion">Conclusão</ToggleGroupItem>
              </ToggleGroup>
            )} />
          </div>
          {kind === "numeric" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="g-target">Valor desejado</Label><Input id="g-target" type="number" min={0} step="any" {...form.register("target_value")} /></div>
              <div className="space-y-2"><Label htmlFor="g-unit">Unidade</Label><Input id="g-unit" placeholder="páginas, dias, km…" {...form.register("unit")} /></div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="g-start">Início</Label><Input id="g-start" type="date" {...form.register("start_date")} /></div>
            <div className="space-y-2"><Label htmlFor="g-deadline">Prazo (opcional)</Label><Input id="g-deadline" type="date" {...form.register("deadline")} /></div>
          </div>
          {habits.length ? (
            <div className="space-y-2">
              <Label>Hábitos relacionados</Label>
              <Controller control={form.control} name="related_habit_ids" render={({ field }) => (
                <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-lg border border-border p-2 scrollbar-thin sm:grid-cols-2">
                  {habits.map((h) => (
                    <label key={h.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={(field.value ?? []).includes(h.id)} onCheckedChange={(c) => field.onChange(c ? [...(field.value ?? []), h.id] : (field.value ?? []).filter((x) => x !== h.id))} />
                      <span className="truncate">{h.name}</span>
                    </label>
                  ))}
                </div>
              )} />
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" loading={pending}>{goal ? "Salvar" : "Criar meta"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
