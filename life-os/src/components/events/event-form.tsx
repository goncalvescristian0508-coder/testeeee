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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createEvent, updateEvent, eventSchema, type EventInput } from "@/lib/actions/events";
import { WEEKDAY_LABELS, minutesToTime, timeToMinutes, toDateStr, toTimeStr, weekdayOf } from "@/lib/dates";
import type { CategoryRow } from "@/lib/database.types";
import type { EventSource } from "@/lib/data/events";

type FormValues = z.input<typeof eventSchema>;

export const EVENT_KIND_LABEL: Record<string, string> = {
  event: "Evento",
  meeting: "Reunião",
  appointment: "Consulta",
  personal: "Pessoal",
  deadline: "Prazo",
  block: "Bloco de tempo",
  recurring: "Atividade recorrente",
};

interface EventFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: EventSource | null;
  categories: CategoryRow[];
  tz: string;
  today: string;
  defaults?: { date?: string; start_time?: string; end_time?: string };
}

export function EventFormDialog({ open, onOpenChange, event, categories, tz, today, defaults }: EventFormProps) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const startTime = defaults?.start_time ?? "09:00";
  const initial: FormValues = event
    ? {
        title: event.title,
        description: event.description ?? "",
        kind: event.kind,
        date: toDateStr(event.start_at, tz),
        start_time: toTimeStr(event.start_at, tz),
        end_time: toTimeStr(event.end_at, tz),
        all_day: event.all_day,
        category_id: event.category_id,
        priority: event.priority,
        location: event.location ?? "",
        notify_minutes_before: event.notify_minutes_before,
        notes: event.notes ?? "",
        recurrence: event.rule
          ? { freq: event.rule.freq, interval: event.rule.interval, by_weekday: event.rule.by_weekday ?? undefined, by_monthday: event.rule.by_monthday, until: event.rule.until ?? "", count: event.rule.count }
          : { freq: "none", interval: 1 },
      }
    : {
        title: "",
        description: "",
        kind: "event",
        date: defaults?.date ?? today,
        start_time: startTime,
        end_time: defaults?.end_time ?? minutesToTime(timeToMinutes(startTime) + 60),
        all_day: false,
        category_id: null,
        priority: 2,
        location: "",
        notify_minutes_before: null,
        notes: "",
        recurrence: { freq: "none", interval: 1 },
      };

  const form = useForm<FormValues>({ resolver: zodResolver(eventSchema), defaultValues: initial, values: initial });
  const allDay = form.watch("all_day");
  const freq = form.watch("recurrence.freq");
  const date = form.watch("date");

  const submit = form.handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = event ? await updateEvent(event.id, values as EventInput) : await createEvent(values as EventInput);
      if (!res.ok) return setError(res.error);
      toast.success(event ? "Compromisso atualizado." : "Compromisso criado.");
      form.reset();
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{event ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
          <DialogDescription>{event?.rule ? "Alterações aqui valem para todas as ocorrências." : "Compromissos, reuniões, consultas e blocos de tempo."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="e-title">Título</Label>
            <Input id="e-title" autoFocus placeholder="Ex.: Faxina geral" {...form.register("title")} aria-invalid={!!form.formState.errors.title} />
            {form.formState.errors.title ? <p className="text-xs text-destructive">{form.formState.errors.title.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVENT_KIND_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
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
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="e-date">Data</Label>
              <Input id="e-date" type="date" {...form.register("date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-start">Início</Label>
              <Input id="e-start" type="time" disabled={!!allDay} {...form.register("start_time")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-end">Fim</Label>
              <Input id="e-end" type="time" disabled={!!allDay} {...form.register("end_time")} aria-invalid={!!form.formState.errors.end_time} />
              {form.formState.errors.end_time ? <p className="text-xs text-destructive">{form.formState.errors.end_time.message}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Controller control={form.control} name="all_day" render={({ field }) => <Switch id="e-allday" checked={!!field.value} onCheckedChange={field.onChange} />} />
            <Label htmlFor="e-allday">Dia inteiro</Label>
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label>Repetir</Label>
            <Controller
              control={form.control}
              name="recurrence.freq"
              render={({ field }) => (
                <ToggleGroup type="single" value={field.value} onValueChange={(v) => v && field.onChange(v)}>
                  <ToggleGroupItem value="none">Não</ToggleGroupItem>
                  <ToggleGroupItem value="daily">Diário</ToggleGroupItem>
                  <ToggleGroupItem value="weekly">Semanal</ToggleGroupItem>
                  <ToggleGroupItem value="monthly">Mensal</ToggleGroupItem>
                  <ToggleGroupItem value="yearly">Anual</ToggleGroupItem>
                </ToggleGroup>
              )}
            />
            {freq !== "none" ? (
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2 text-sm">
                  <span>A cada</span>
                  <Input type="number" min={1} max={365} className="w-20" {...form.register("recurrence.interval")} />
                  <span className="text-muted-foreground">{{ daily: "dia(s) — ex.: 15 para cortar o cabelo a cada 15 dias", weekly: "semana(s)", monthly: "mês(es)", yearly: "ano(s)" }[freq as "daily" | "weekly" | "monthly" | "yearly"]}</span>
                </div>
                {freq === "weekly" ? (
                  <Controller
                    control={form.control}
                    name="recurrence.by_weekday"
                    render={({ field }) => (
                      <ToggleGroup type="multiple" value={(field.value ?? (date ? [weekdayOf(date)] : [])).map(String)} onValueChange={(v) => field.onChange(v.map(Number).sort())}>
                        {WEEKDAY_LABELS.map((l, i) => (
                          <ToggleGroupItem key={i} value={String(i)}>{l}</ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                  />
                ) : null}
                {freq === "monthly" ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span>No dia</span>
                    <Input type="number" min={1} max={31} className="w-20" placeholder={date ? String(Number(date.slice(8, 10))) : "1"} {...form.register("recurrence.by_monthday")} />
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="e-until" className="text-xs">Até (opcional)</Label>
                    <Input id="e-until" type="date" {...form.register("recurrence.until")} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="e-count" className="text-xs">Nº de vezes (opcional)</Label>
                    <Input id="e-count" type="number" min={1} {...form.register("recurrence.count")} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="e-loc">Local (opcional)</Label>
              <Input id="e-loc" {...form.register("location")} />
            </div>
            <div className="space-y-2">
              <Label>Notificar</Label>
              <Controller
                control={form.control}
                name="notify_minutes_before"
                render={({ field }) => (
                  <Select value={field.value == null ? "none" : String(field.value)} onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não notificar</SelectItem>
                      <SelectItem value="0">Na hora</SelectItem>
                      <SelectItem value="10">10 min antes</SelectItem>
                      <SelectItem value="30">30 min antes</SelectItem>
                      <SelectItem value="60">1 hora antes</SelectItem>
                      <SelectItem value="1440">1 dia antes</SelectItem>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="e-desc">Descrição</Label>
            <Textarea id="e-desc" rows={2} {...form.register("description")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-notes">Observações</Label>
            <Textarea id="e-notes" rows={2} {...form.register("notes")} />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" loading={pending}>{event ? "Salvar" : "Criar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
