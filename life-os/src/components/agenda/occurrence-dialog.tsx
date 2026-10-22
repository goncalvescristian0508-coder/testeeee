"use client";

import { useState, useTransition } from "react";
import { CalendarX2, MapPin, Pencil, Repeat, RotateCcw, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EventFormDialog, EVENT_KIND_LABEL } from "@/components/events/event-form";
import { deleteEvent, endRecurrenceBefore, restoreOccurrence, skipOccurrence } from "@/lib/actions/events";
import { describeRule } from "@/lib/recurrence";
import { fmtInTz, normalizeTime, toTimeStr } from "@/lib/dates";
import type { EventOccurrence } from "@/lib/data/events";
import type { CategoryRow } from "@/lib/database.types";

interface Props {
  occurrence: EventOccurrence | null;
  onClose: () => void;
  categories: CategoryRow[];
  tz: string;
  today: string;
}

export function OccurrenceDialog({ occurrence, onClose, categories, tz, today }: Props) {
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState<"delete" | "end" | null>(null);
  const [pending, start] = useTransition();
  if (!occurrence && !edit) return null;
  const o = occurrence;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Erro");
      else {
        toast.success(msg);
        onClose();
      }
    });

  const category = o ? categories.find((c) => c.id === o.source.category_id) : null;

  return (
    <>
      <Dialog open={!!o && !edit} onOpenChange={(v) => !v && onClose()}>
        {o ? (
          <DialogContent>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2 pr-6">
                <Badge variant="secondary">{EVENT_KIND_LABEL[o.source.kind]}</Badge>
                {category ? <Badge variant="outline"><span className="size-2 rounded-full" style={{ backgroundColor: category.color }} />{category.name}</Badge> : null}
                {o.moved ? <Badge variant="warning">Remarcado</Badge> : null}
                {o.source.priority === 1 ? <Badge variant="destructive">Alta prioridade</Badge> : null}
              </div>
              <DialogTitle className="pt-1">{o.source.title}</DialogTitle>
              <DialogDescription className="capitalize">
                {fmtInTz(o.start_at, "EEEE, d 'de' MMMM", tz)} · {o.source.all_day ? "Dia inteiro" : `${normalizeTime(toTimeStr(o.start_at, tz))} – ${normalizeTime(toTimeStr(o.end_at, tz))}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              {o.source.location ? <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="size-4" />{o.source.location}</p> : null}
              {o.source.rule ? <p className="flex items-center gap-2 text-muted-foreground"><Repeat className="size-4" />{describeRule(o.source.rule)}</p> : null}
              {o.source.description ? <p>{o.source.description}</p> : null}
              {o.source.notes ? <p className="rounded-lg bg-muted p-3 text-muted-foreground">{o.source.notes}</p> : null}
              {o.source.notify_minutes_before != null ? <p className="text-xs text-muted-foreground">Lembrete {o.source.notify_minutes_before === 0 ? "na hora" : `${o.source.notify_minutes_before} min antes`} (requer notificações ativas).</p> : null}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" onClick={() => setEdit(true)}><Pencil /> Editar{o.isRecurring ? " série" : ""}</Button>
              {o.isRecurring ? (
                o.moved || o.source.exceptions.some((e) => e.original_date === o.originalDate) ? (
                  <Button size="sm" variant="outline" onClick={() => run(() => restoreOccurrence(o.source.id, o.originalDate), "Ocorrência restaurada.")} loading={pending}><RotateCcw /> Restaurar horário original</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => run(() => skipOccurrence(o.source.id, o.originalDate), "Esta ocorrência foi cancelada.")} loading={pending}><CalendarX2 /> Cancelar só esta</Button>
                )
              ) : null}
              {o.isRecurring && o.originalDate > today ? <Button size="sm" variant="outline" onClick={() => setConfirm("end")}><Scissors /> Encerrar a partir daqui</Button> : null}
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirm("delete")}><Trash2 /> Excluir{o.isRecurring ? " série" : ""}</Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      {o ? <EventFormDialog open={edit} onOpenChange={(v) => { setEdit(v); if (!v) onClose(); }} event={o.source} categories={categories} tz={tz} today={today} /> : null}

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "delete" ? "Excluir compromisso?" : "Encerrar recorrência?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "delete" ? (o?.isRecurring ? "Todas as ocorrências desta série serão removidas." : "Esta ação não pode ser desfeita.") : "As ocorrências a partir desta data deixarão de existir. As anteriores são mantidas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!o) return;
                const c = confirm;
                setConfirm(null);
                if (c === "delete") run(() => deleteEvent(o.source.id), "Compromisso excluído.");
                else run(() => endRecurrenceBefore(o.source.id, o.originalDate), "Recorrência encerrada.");
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
