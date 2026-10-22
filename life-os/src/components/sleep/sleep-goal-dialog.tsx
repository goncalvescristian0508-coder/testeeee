"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveSleepGoal } from "@/lib/actions/sleep";
import type { SleepGoalRow } from "@/lib/database.types";
import { normalizeTime } from "@/lib/dates";
import { uid } from "@/lib/utils";

type Step = { id: string; title: string };

export function SleepGoalDialog({ open, onOpenChange, goal }: { open: boolean; onOpenChange: (o: boolean) => void; goal: SleepGoalRow }) {
  const [bedtime, setBedtime] = useState(normalizeTime(goal.bedtime));
  const [wake, setWake] = useState(normalizeTime(goal.wake_time));
  const [hours, setHours] = useState(String(goal.target_hours));
  const [wind, setWind] = useState(String(goal.wind_down_minutes));
  const [evening, setEvening] = useState<Step[]>((goal.evening_routine as Step[]) ?? []);
  const [morning, setMorning] = useState<Step[]>((goal.morning_routine as Step[]) ?? []);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await saveSleepGoal({ bedtime, wake_time: wake, target_hours: Number(hours), wind_down_minutes: Number(wind), evening_routine: evening.filter((s) => s.title.trim()), morning_routine: morning.filter((s) => s.title.trim()) });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Metas de sono salvas.");
      onOpenChange(false);
    });

  const list = (steps: Step[], set: (s: Step[]) => void, label: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => set([...steps, { id: uid(), title: "" }])}><Plus /> Passo</Button>
      </div>
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <Input value={s.title} placeholder={`Passo ${i + 1}`} onChange={(e) => set(steps.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))} />
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remover" onClick={() => set(steps.filter((x) => x.id !== s.id))}><Trash2 /></Button>
        </div>
      ))}
      {steps.length === 0 ? <p className="text-xs text-muted-foreground">Ex.: guardar o celular, preparar roupa, ler 10 páginas.</p> : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Metas de sono e rotinas</DialogTitle>
          <DialogDescription>Os lembretes de dormir e de desacelerar usam estes horários.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-2"><Label htmlFor="sg-bed">Dormir</Label><Input id="sg-bed" type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="sg-wake">Acordar</Label><Input id="sg-wake" type="time" value={wake} onChange={(e) => setWake(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="sg-h">Meta (h)</Label><Input id="sg-h" type="number" min={3} max={14} step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="sg-w">Desacelerar (min)</Label><Input id="sg-w" type="number" min={0} max={240} value={wind} onChange={(e) => setWind(e.target.value)} /></div>
          </div>
          {list(evening, setEvening, "Rotina noturna")}
          {list(morning, setMorning, "Rotina matinal")}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save} loading={pending}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
