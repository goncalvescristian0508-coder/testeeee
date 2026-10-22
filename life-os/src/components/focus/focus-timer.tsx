"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertCircle, Bell, BellOff, Pause, Play, Square, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { finishFocusSession, heartbeatFocusSession, startFocusSession } from "@/lib/actions/focus";
import { fmtClock, POMODORO } from "@/lib/focus";
import { clockStore, focusStore, permissionStore, type ActiveFocus, type FocusMode } from "@/lib/focus/store";
import { playBeep, requestLocalPermission, showLocalNotification } from "@/lib/notifications/local";
import type { HabitRow } from "@/lib/database.types";
import { cn, uid } from "@/lib/utils";

const PRESETS = ["Ler durante 20 minutos", "Organizar o quarto", "Estudar", "Trabalhar", "Ficar 1 hora sem redes sociais"];

function notify(title: string, body: string) {
  playBeep();
  if (!showLocalNotification(title, body)) toast(title, { description: body });
}

function elapsedOf(a: ActiveFocus, now: number) {
  return a.elapsedBefore + (a.runningSince ? (now - a.runningSince) / 1000 : 0);
}

/** Avança fases quando o tempo acaba (chamado a cada tick). Determinístico a partir do relógio. */
function advance(a: ActiveFocus, now: number): ActiveFocus | null {
  if (a.mode === "stopwatch" || a.phase === "done" || !a.runningSince) return null;
  const elapsed = elapsedOf(a, now);
  if (elapsed < a.phaseSeconds) return null;
  if (a.phase === "focus") {
    const focusAccumulated = a.focusAccumulated + a.phaseSeconds;
    if (a.mode === "pomodoro") {
      const cycle = a.cycle + 1;
      const long = cycle % POMODORO.cyclesBeforeLong === 0;
      notify(long ? "Pausa longa" : "Pausa curta", `Descanse ${long ? POMODORO.long : POMODORO.short} minutos.`);
      return { ...a, phase: long ? "long" : "short", cycle, phaseSeconds: (long ? POMODORO.long : POMODORO.short) * 60, elapsedBefore: 0, runningSince: now, focusAccumulated };
    }
    notify("Tempo concluído", `${a.activity}: meta de ${a.plannedMinutes} min atingida.`);
    return { ...a, phase: "done", runningSince: null, elapsedBefore: a.phaseSeconds, focusAccumulated };
  }
  notify("Hora de voltar ao foco", `Ciclo ${a.cycle + 1}: ${a.activity}`);
  return { ...a, phase: "focus", phaseSeconds: POMODORO.focus * 60, elapsedBefore: 0, runningSince: now };
}

export function FocusTimer({ habits }: { habits: HabitRow[] }) {
  const active = useSyncExternalStore(focusStore.subscribe, focusStore.get, focusStore.getServer);
  return active ? <ActiveSession active={active} /> : <SetupForm habits={habits} />;
}

function ActiveSession({ active }: { active: ActiveFocus }) {
  const now = useSyncExternalStore(clockStore.subscribe, clockStore.get, clockStore.getServer);
  const [note, setNote] = useState("");
  const [finishing, setFinishing] = useState(false);
  const elapsed = elapsedOf(active, now);
  const remaining = active.phaseSeconds - elapsed;
  const focusSeconds = Math.round(active.focusAccumulated + (active.phase === "focus" ? Math.min(elapsed, active.phaseSeconds) : 0));

  // Transição de fase e heartbeat: efeitos que escrevem em sistemas externos (store/servidor).
  useEffect(() => {
    const next = advance(active, now);
    if (next) focusStore.set(next);
  }, [active, now]);

  useEffect(() => {
    if (!active.runningSince || active.phase !== "focus") return;
    const t = setInterval(() => {
      const cur = focusStore.get();
      if (!cur) return;
      heartbeatFocusSession(cur.clientId, cur.focusAccumulated + Math.min(elapsedOf(cur, Date.now()), cur.phaseSeconds), cur.interruptions);
    }, 60000);
    return () => clearInterval(t);
  }, [active.runningSince, active.phase]);

  const finish = async (completed: boolean) => {
    setFinishing(true);
    const a = active;
    const seconds = focusSeconds;
    focusStore.set(null);
    const res = await finishFocusSession({ client_id: a.clientId, actual_seconds: seconds, completed, interruptions: a.interruptions, note, ended_at: new Date().toISOString() });
    if (!res.ok) toast.error(res.error);
    else toast.success(completed ? `Sessão concluída: ${fmtClock(seconds)} de foco.` : `Sessão encerrada: ${fmtClock(seconds)} registrados.`);
  };

  const pause = () => focusStore.update((a) => (a.runningSince ? { ...a, elapsedBefore: a.elapsedBefore + (Date.now() - a.runningSince) / 1000, runningSince: null } : a));
  const resume = () => focusStore.update((a) => (a.runningSince ? a : { ...a, runningSince: Date.now() }));
  const interrupt = () => focusStore.update((a) => ({ ...a, interruptions: a.interruptions + 1 }));

  const isFocus = active.phase === "focus";
  const label = active.phase === "done" ? "Concluído" : isFocus ? "Foco" : active.phase === "long" ? "Pausa longa" : "Pausa curta";
  const display = active.mode === "stopwatch" ? fmtClock(elapsed) : active.phase === "done" ? fmtClock(0) : fmtClock(Math.max(0, remaining));
  const progress = active.mode === "stopwatch" || active.phase === "done" ? 100 : Math.min(100, (elapsed / active.phaseSeconds) * 100);

  return (
    <div className="space-y-6">
      <div className={cn("relative overflow-hidden rounded-3xl border border-border bg-card p-8 text-center transition-colors", isFocus && active.runningSince && "border-success/40")}>
        <div className="absolute inset-x-0 top-0 h-1 bg-muted"><div className={cn("h-full transition-[width] duration-300", isFocus ? "bg-success" : "bg-chart-4")} style={{ width: `${progress}%` }} /></div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}{active.mode === "pomodoro" ? ` · ciclo ${active.cycle + 1}` : ""}</p>
        <p className="mt-2 font-mono text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl">{display}</p>
        <p className="mt-3 text-lg font-medium">{active.activity}</p>
        {active.goal ? <p className="text-sm text-muted-foreground">{active.goal}</p> : null}
        {active.avoidSocial ? <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"><BellOff className="size-3" /> Sem redes sociais nesta sessão</p> : null}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {active.phase !== "done" ? (active.runningSince ? <Button size="lg" variant="outline" onClick={pause}><Pause /> Pausar</Button> : <Button size="lg" variant="success" onClick={resume}><Play /> Retomar</Button>) : null}
          {active.phase === "done" || active.mode === "stopwatch" ? <Button size="lg" variant="success" onClick={() => finish(true)} loading={finishing}><Square /> Concluir</Button> : <Button size="lg" variant="ghost" onClick={() => finish(false)} loading={finishing}><Square /> Encerrar antes</Button>}
          {active.phase === "focus" ? <Button size="lg" variant="ghost" onClick={interrupt}><AlertCircle /> Interrupção ({active.interruptions})</Button> : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="f-note">Observação (opcional)</Label>
        <Textarea id="f-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que atrapalhou? O que funcionou?" />
      </div>
      <p className="text-xs text-muted-foreground">O cronômetro usa o relógio do dispositivo e continua correto se a aba ficar em segundo plano. Alertas sonoros e notificações só funcionam com o site aberto.</p>
    </div>
  );
}

function SetupForm({ habits }: { habits: HabitRow[] }) {
  const notif = useSyncExternalStore(permissionStore.subscribe, permissionStore.get, permissionStore.getServer);
  const [mode, setMode] = useState<FocusMode>("pomodoro");
  const [activity, setActivity] = useState("");
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState("25");
  const [avoidSocial, setAvoidSocial] = useState(false);
  const [habitId, setHabitId] = useState("none");
  const [starting, setStarting] = useState(false);

  const start = async () => {
    const act = activity.trim();
    if (!act) {
      toast.error("Diga o que vai fazer nesta sessão.");
      return;
    }
    setStarting(true);
    const planned = mode === "pomodoro" ? POMODORO.focus : mode === "stopwatch" ? null : Math.max(1, Number(minutes) || 25);
    const clientId = uid();
    const res = await startFocusSession({ client_id: clientId, activity: act, goal, mode, planned_minutes: planned, avoid_social: avoidSocial || mode === "social_free", habit_id: habitId === "none" ? null : habitId, started_at: new Date().toISOString() });
    setStarting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const now = Date.now();
    focusStore.set({ clientId, activity: act, goal, mode, plannedMinutes: planned, avoidSocial: avoidSocial || mode === "social_free", habitId: habitId === "none" ? null : habitId, startedAt: now, elapsedBefore: 0, runningSince: now, focusAccumulated: 0, interruptions: 0, cycle: 0, phase: "focus", phaseSeconds: planned ? planned * 60 : Number.MAX_SAFE_INTEGER });
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="space-y-2">
        <Label>Modo</Label>
        <ToggleGroup type="single" value={mode} onValueChange={(v) => { if (!v) return; setMode(v as FocusMode); if (v === "social_free") { setAvoidSocial(true); setMinutes("60"); if (!activity) setActivity("Ficar 1 hora sem redes sociais"); } }}>
          <ToggleGroupItem value="pomodoro">Pomodoro 25/5</ToggleGroupItem>
          <ToggleGroupItem value="custom">Personalizado</ToggleGroupItem>
          <ToggleGroupItem value="stopwatch">Contagem progressiva</ToggleGroupItem>
          <ToggleGroupItem value="social_free">Sem redes sociais</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor="f-act">O que vou fazer</Label>
        <Input id="f-act" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="Ex.: Ler durante 20 minutos" />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setActivity(p)} className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent">{p}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {mode === "custom" || mode === "social_free" ? (
          <div className="space-y-2"><Label htmlFor="f-min">Quanto tempo (min)</Label><Input id="f-min" type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
        ) : null}
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="f-goal">Objetivo (opcional)</Label><Input id="f-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex.: terminar o capítulo 3" /></div>
        {habits.length ? (
          <div className="space-y-2 sm:col-span-3">
            <Label>Vincular a um hábito</Label>
            <Select value={habitId} onValueChange={setHabitId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">Nenhum</SelectItem>{habits.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <div><p className="text-sm font-medium">Evitar redes sociais</p><p className="text-xs text-muted-foreground">Compromisso declarado; o site não bloqueia outros apps.</p></div>
        <Switch checked={avoidSocial || mode === "social_free"} disabled={mode === "social_free"} onCheckedChange={setAvoidSocial} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {notif === "default" ? (
          <Button variant="ghost" size="sm" onClick={async () => { await requestLocalPermission(); permissionStore.refresh(); }}><Bell /> Permitir aviso ao terminar</Button>
        ) : notif === "denied" ? (
          <span className="text-xs text-muted-foreground">Notificações bloqueadas no navegador; usaremos som e aviso na tela.</span>
        ) : notif === "unsupported" ? (
          <span className="text-xs text-muted-foreground">Este navegador não exibe notificações; usaremos som e aviso na tela.</span>
        ) : <span className="text-xs text-muted-foreground">Aviso ao terminar ativado (com o site aberto).</span>}
        <Button size="lg" onClick={start} loading={starting}><Timer /> Começar</Button>
      </div>
    </div>
  );
}
