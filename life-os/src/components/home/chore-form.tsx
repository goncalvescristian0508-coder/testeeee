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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createChore, updateChore, choreSchema, type ChoreInput } from "@/lib/actions/home";
import { WEEKDAY_LONG } from "@/lib/dates";
import type { ChoreWithItems } from "@/lib/data/home";

type FormValues = z.input<typeof choreSchema>;

const PRESETS = [
  { name: "Lavar roupas", every: 7, items: ["Separar roupas", "Lavar", "Estender", "Guardar"] },
  { name: "Trocar roupa de cama", every: 7, items: [] },
  { name: "Limpar banheiro", every: 7, items: ["Vaso", "Pia e espelho", "Box", "Chão"] },
  { name: "Varrer o quarto", every: 3, items: [] },
  { name: "Passar pano", every: 7, items: [] },
  { name: "Organizar armário", every: 30, items: [] },
  { name: "Retirar lixo", every: 2, items: [] },
  { name: "Faxina geral", every: 7, items: ["Tirar o pó", "Varrer", "Passar pano", "Banheiro", "Cozinha", "Organizar"] },
];

export function ChoreFormDialog({ open, onOpenChange, chore }: { open: boolean; onOpenChange: (o: boolean) => void; chore?: ChoreWithItems | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const defaults: FormValues = chore
    ? { name: chore.name, description: chore.description ?? "", every_days: chore.every_days, preferred_weekday: chore.preferred_weekday, estimated_minutes: chore.estimated_minutes, items: chore.items.map((i) => ({ id: i.id, title: i.title })) }
    : { name: "", description: "", every_days: 7, preferred_weekday: null, estimated_minutes: null, items: [] };
  const form = useForm<FormValues>({ resolver: zodResolver(choreSchema), defaultValues: defaults, values: defaults });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" });

  const submit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = chore ? await updateChore(chore.id, values as ChoreInput) : await createChore(values as ChoreInput);
      if (!res.ok) return setError(res.error);
      toast.success(chore ? "Tarefa atualizada." : "Tarefa doméstica criada.");
      form.reset();
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{chore ? "Editar tarefa doméstica" : "Nova tarefa doméstica"}</DialogTitle>
          <DialogDescription>Defina a periodicidade e, se quiser, um checklist de etapas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {!chore ? (
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => { form.setValue("name", p.name); form.setValue("every_days", p.every); replace(p.items.map((t) => ({ title: t }))); }} className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent">
                  {p.name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="c-name">Nome</Label>
            <Input id="c-name" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
            {form.formState.errors.name ? <p className="text-xs text-destructive">{form.formState.errors.name.message}</p> : null}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-every">A cada (dias)</Label>
              <Input id="c-every" type="number" min={1} max={365} {...form.register("every_days")} />
            </div>
            <div className="space-y-2">
              <Label>Dia preferido</Label>
              <Controller
                control={form.control}
                name="preferred_weekday"
                render={({ field }) => (
                  <Select value={field.value == null ? "any" : String(field.value)} onValueChange={(v) => field.onChange(v === "any" ? null : Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer</SelectItem>
                      {WEEKDAY_LONG.map((l, i) => (
                        <SelectItem key={i} value={String(i)}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-min">Duração (min)</Label>
              <Input id="c-min" type="number" min={0} {...form.register("estimated_minutes")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-desc">Descrição</Label>
            <Textarea id="c-desc" rows={2} {...form.register("description")} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Checklist</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => append({ title: "" })}><Plus /> Etapa</Button>
            </div>
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2">
                <Input placeholder={`Etapa ${i + 1}`} {...form.register(`items.${i}.title` as const)} />
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover" onClick={() => remove(i)}><Trash2 /></Button>
              </div>
            ))}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={pending}>{chore ? "Salvar" : "Criar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
