"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createHabit, updateHabit, habitSchema, type HabitInput } from "@/lib/actions/habits";
import { ICON_NAMES, COLORS } from "@/lib/icons";
import { HabitIcon } from "./habit-icon";
import { WEEKDAY_LABELS } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { CategoryRow, HabitRow, HabitScheduleRow } from "@/lib/database.types";

const formSchema = habitSchema;
type FormValues = z.input<typeof formSchema>;

interface HabitFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit?: HabitRow | null;
  schedule?: HabitScheduleRow | null;
  categories: CategoryRow[];
  today: string;
  onSaved?: (id: string) => void;
}

export function HabitFormDialog({ open, onOpenChange, habit, schedule, categories, today, onSaved }: HabitFormProps) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const defaults: FormValues = habit
    ? {
        name: habit.name,
        description: habit.description ?? "",
        icon: habit.icon,
        color: habit.color,
        category_id: habit.category_id,
        kind: habit.kind,
        target_value: habit.target_value,
        unit: habit.unit ?? "",
        recommended_time: habit.recommended_time?.slice(0, 5) ?? "",
        estimated_minutes: habit.estimated_minutes,
        period: habit.period ?? "",
        start_date: habit.start_date,
        reminder_time: habit.reminder_time?.slice(0, 5) ?? "",
        reminder_enabled: habit.reminder_enabled,
        priority: habit.priority,
        show_on_dashboard: habit.show_on_dashboard,
        frequency: schedule?.frequency ?? "daily",
        weekdays: schedule?.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
        times_per_week: schedule?.times_per_week ?? 3,
      }
    : {
        name: "",
        description: "",
        icon: "check",
        color: "#22c55e",
        category_id: null,
        kind: "boolean",
        target_value: null,
        unit: "",
        recommended_time: "",
        estimated_minutes: null,
        period: "",
        start_date: today,
        reminder_time: "",
        reminder_enabled: false,
        priority: 2,
        show_on_dashboard: true,
        frequency: "daily",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        times_per_week: 3,
      };

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: defaults, values: defaults });
  const kind = form.watch("kind");
  const frequency = form.watch("frequency");
  const icon = form.watch("icon");
  const color = form.watch("color");
  const reminderEnabled = form.watch("reminder_enabled");

  const submit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = habit ? await updateHabit(habit.id, values as HabitInput) : await createHabit(values as HabitInput);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(habit ? "Hábito atualizado." : "Hábito criado.");
      onOpenChange(false);
      form.reset();
      const id = habit ? habit.id : (res as { data?: { id: string } }).data?.id;
      if (id) onSaved?.(id);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{habit ? "Editar hábito" : "Novo hábito"}</DialogTitle>
          <DialogDescription>Pequenas ações repetidas constroem a rotina.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color + "22", color }}>
              <HabitIcon name={icon} className="size-6" />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="h-name">Nome</Label>
              <Input id="h-name" placeholder="Ex.: Ler 10 páginas" autoFocus {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
              {form.formState.errors.name ? <p className="text-xs text-destructive">{form.formState.errors.name.message}</p> : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_NAMES.map((n) => {
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={n}
                    aria-pressed={icon === n}
                    onClick={() => form.setValue("icon", n)}
                    className={cn("flex size-9 items-center justify-center rounded-lg border border-border transition-colors hover:bg-accent", icon === n && "border-success bg-success/15 text-success")}
                  >
                    <HabitIcon name={n} className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  aria-pressed={color === c}
                  onClick={() => form.setValue("color", c)}
                  className={cn("size-7 rounded-full border-2 transition-transform", color === c ? "scale-110 border-foreground" : "border-transparent")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="h-desc">Descrição (opcional)</Label>
            <Textarea id="h-desc" rows={2} placeholder="Por que esse hábito importa para você?" {...form.register("description")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boolean">Sim ou não</SelectItem>
                      <SelectItem value="quantity">Por quantidade</SelectItem>
                      <SelectItem value="duration">Por duração</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {kind !== "boolean" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="h-target">Meta</Label>
                  <Input id="h-target" type="number" inputMode="decimal" min={0} step="any" placeholder={kind === "duration" ? "15" : "10"} {...form.register("target_value")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="h-unit">Unidade</Label>
                  {kind === "duration" ? <Input id="h-unit" value="min" disabled /> : <Input id="h-unit" placeholder="páginas" {...form.register("unit")} />}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Categoria</Label>
                <CategorySelect control={form.control} categories={categories} />
              </div>
            )}
          </div>
          {kind !== "boolean" ? (
            <div className="space-y-2">
              <Label>Categoria</Label>
              <CategorySelect control={form.control} categories={categories} />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Frequência</Label>
            <Controller
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <ToggleGroup type="single" value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <ToggleGroupItem value="daily">Todo dia</ToggleGroupItem>
                  <ToggleGroupItem value="weekdays">Dias da semana</ToggleGroupItem>
                  <ToggleGroupItem value="times_per_week">X vezes por semana</ToggleGroupItem>
                </ToggleGroup>
              )}
            />
            {frequency === "weekdays" ? (
              <Controller
                control={form.control}
                name="weekdays"
                render={({ field }) => (
                  <ToggleGroup type="multiple" value={(field.value ?? []).map(String)} onValueChange={(v) => field.onChange(v.map(Number).sort())} className="pt-1">
                    {WEEKDAY_LABELS.map((l, i) => (
                      <ToggleGroupItem key={i} value={String(i)} aria-label={l}>
                        {l}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                )}
              />
            ) : null}
            {frequency === "times_per_week" ? (
              <div className="flex items-center gap-2 pt-1">
                <Input type="number" min={1} max={7} className="w-20" {...form.register("times_per_week")} />
                <span className="text-sm text-muted-foreground">vezes por semana, em qualquer dia</span>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="h-time">Horário sugerido</Label>
              <Input id="h-time" type="time" {...form.register("recommended_time")} />
            </div>
            <div className="space-y-2">
              <Label>Período</Label>
              <Controller
                control={form.control}
                name="period"
                render={({ field }) => (
                  <Select value={field.value || "auto"} onValueChange={(v) => field.onChange(v === "auto" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
              <Label htmlFor="h-est">Duração (min)</Label>
              <Input id="h-est" type="number" min={0} inputMode="numeric" placeholder="10" {...form.register("estimated_minutes")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="h-start">Data de início</Label>
              <Input id="h-start" type="date" {...form.register("start_date")} />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Controller
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
              <Label htmlFor="h-rem">Lembrete</Label>
              <div className="flex items-center gap-2">
                <Controller control={form.control} name="reminder_enabled" render={({ field }) => <Switch id="h-rem" checked={!!field.value} onCheckedChange={field.onChange} />} />
                <Input type="time" disabled={!reminderEnabled} {...form.register("reminder_time")} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Mostrar na tela inicial</p>
              <p className="text-xs text-muted-foreground">Aparece no resumo diário do dashboard.</p>
            </div>
            <Controller control={form.control} name="show_on_dashboard" render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} />} />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {habit ? "Salvar" : "Criar hábito"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategorySelect({ control, categories }: { control: ReturnType<typeof useForm<FormValues>>["control"]; categories: CategoryRow[] }) {
  return (
    <Controller
      control={control}
      name="category_id"
      render={({ field }) => (
        <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? null : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Sem categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem categoria</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}
