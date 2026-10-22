"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveSleepLog } from "@/lib/actions/sleep";
import type { SleepGoalRow, SleepLogRow } from "@/lib/database.types";
import { normalizeTime, toTimeStr } from "@/lib/dates";

const QUALITY = ["Péssimo", "Ruim", "Ok", "Bom", "Ótimo"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  log: SleepLogRow | null;
  goal: SleepGoalRow;
  today: string;
  tz: string;
}

/** O formulário vive dentro do DialogContent: desmonta ao fechar e reinicia ao abrir. */
export function SleepLogDialog({ open, onOpenChange, log, goal, today, tz }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{log ? "Editar noite" : "Registrar noite de sono"}</DialogTitle>
          <DialogDescription>Informe a data em que acordou. Horários de deitar maiores que o de acordar contam como noite anterior.</DialogDescription>
        </DialogHeader>
        <SleepLogForm log={log} goal={goal} today={today} tz={tz} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SleepLogForm({ log, goal, today, tz, onDone }: { log: SleepLogRow | null; goal: SleepGoalRow; today: string; tz: string; onDone: () => void }) {
  const [date, setDate] = useState(log?.date ?? today);
  const [bed, setBed] = useState(log ? toTimeStr(log.bed_at, tz) : normalizeTime(goal.bedtime));
  const [asleep, setAsleep] = useState(log?.asleep_at ? toTimeStr(log.asleep_at, tz) : "");
  const [wake, setWake] = useState(log ? toTimeStr(log.wake_at, tz) : normalizeTime(goal.wake_time));
  const [quality, setQuality] = useState(log?.quality ? String(log.quality) : "");
  const [awak, setAwak] = useState(log?.awakenings != null ? String(log.awakenings) : "");
  const [notes, setNotes] = useState(log?.notes ?? "");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await saveSleepLog({ date, bed_time: bed, asleep_time: asleep, wake_time: wake, quality: quality ? Number(quality) : null, awakenings: awak ? Number(awak) : null, notes });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Noite registrada.");
      onDone();
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-2"><Label htmlFor="sl-date">Acordei em</Label><Input id="sl-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} disabled={!!log} /></div>
        <div className="space-y-2"><Label htmlFor="sl-bed">Deitei às</Label><Input id="sl-bed" type="time" value={bed} onChange={(e) => setBed(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="sl-asleep">Adormeci (aprox.)</Label><Input id="sl-asleep" type="time" value={asleep} onChange={(e) => setAsleep(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="sl-wake">Acordei às</Label><Input id="sl-wake" type="time" value={wake} onChange={(e) => setWake(e.target.value)} /></div>
      </div>
      <div className="space-y-2">
        <Label>Qualidade subjetiva</Label>
        <ToggleGroup type="single" value={quality} onValueChange={setQuality}>
          {QUALITY.map((q, i) => (
            <ToggleGroupItem key={q} value={String(i + 1)}>{q}</ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2"><Label htmlFor="sl-aw">Despertares (opcional)</Label><Input id="sl-aw" type="number" min={0} value={awak} onChange={(e) => setAwak(e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="sl-notes">Observações</Label><Textarea id="sl-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Café tarde, celular na cama, barulho..." /></div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button onClick={save} loading={pending}>Salvar</Button>
      </div>
    </div>
  );
}
