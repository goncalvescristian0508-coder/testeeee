"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PushManager } from "./push-manager";
import { saveNotificationPreferences } from "@/lib/actions/settings";
import type { NotificationPreferencesRow } from "@/lib/database.types";

const ITEMS: { key: keyof Pick<NotificationPreferencesRow, "habits" | "events" | "bedtime" | "evening_routine" | "morning_routine" | "overdue_tasks">; label: string; hint: string }[] = [
  { key: "habits", label: "Hábitos", hint: "No horário de lembrete de cada hábito (se não foi concluído)." },
  { key: "events", label: "Compromissos", hint: "Conforme a antecedência definida em cada compromisso." },
  { key: "bedtime", label: "Hora de dormir", hint: "No horário planejado em Sono." },
  { key: "evening_routine", label: "Rotina noturna", hint: "Quando começar a desacelerar." },
  { key: "morning_routine", label: "Rotina matinal", hint: "No horário planejado de acordar." },
  { key: "overdue_tasks", label: "Tarefas atrasadas", hint: "Um resumo diário, no horário abaixo." },
];

export function NotificationPrefs({ prefs }: { prefs: NotificationPreferencesRow }) {
  const [state, setState] = useState({ ...prefs, overdue_tasks_time: prefs.overdue_tasks_time.slice(0, 5), quiet_start: prefs.quiet_start?.slice(0, 5) ?? "", quiet_end: prefs.quiet_end?.slice(0, 5) ?? "" });
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await saveNotificationPreferences(state);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Lembretes salvos.");
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificações e lembretes</CardTitle>
        <CardDescription>Entregues por Web Push, mesmo com o app fechado, quando o dispositivo tiver suporte e permissão. Os envios são agendados no servidor a cada 5 minutos; cada lembrete é enviado uma única vez.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <PushManager />
        <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Requisitos no iPhone</p>
          <p>iOS 16.4 ou superior, app adicionado à Tela de Início pelo Safari e aberto pelo ícone. Notificações não chegam na aba do Safari. Em outros aparelhos: Chrome, Edge, Firefox ou Safari no macOS 13+.</p>
        </div>
        <div className="space-y-3">
          {ITEMS.map((it) => (
            <div key={it.key} className="flex items-center justify-between gap-3">
              <div><p className="text-sm font-medium">{it.label}</p><p className="text-xs text-muted-foreground">{it.hint}</p></div>
              <Switch checked={state[it.key]} onCheckedChange={(c) => setState({ ...state, [it.key]: c })} aria-label={it.label} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1"><Label htmlFor="n-overdue" className="text-xs">Resumo de atrasadas às</Label><Input id="n-overdue" type="time" value={state.overdue_tasks_time} onChange={(e) => setState({ ...state, overdue_tasks_time: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="n-qs" className="text-xs">Silêncio de</Label><Input id="n-qs" type="time" value={state.quiet_start} onChange={(e) => setState({ ...state, quiet_start: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="n-qe" className="text-xs">até</Label><Input id="n-qe" type="time" value={state.quiet_end} onChange={(e) => setState({ ...state, quiet_end: e.target.value })} /></div>
        </div>
        <div className="flex justify-end"><Button onClick={save} loading={pending}>Salvar</Button></div>
      </CardContent>
    </Card>
  );
}
