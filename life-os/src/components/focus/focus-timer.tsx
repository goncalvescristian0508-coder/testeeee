"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { localNotificationSupport, playBeep, requestLocalPermission, showLocalNotification } from "@/lib/notifications/local";
import type { HabitRow } from "@/lib/database.types";
import { cn, uid } from "@/lib/utils";

type Mode = "pomodoro" | "custom" | "stopwatch" | "social_free";
type Phase = "idle" | "focus" | "short" | "long" | "done";

const PRESETS = ["Ler durante 20 minutos", "Organizar o quarto", "Estudar", "Trabalhar", "Ficar 1 hora sem redes sociais"];
const STORAGE_KEY = "lifeos:focus:active";

interface Active {
  clientId: string;
  activity: string;
  goal: string;
  mode: Mode;
  plannedMinutes: number | null;
  avoidSocial: boolean;
  habitId: string | null;
  startedAt: number; // epoch ms
  elapsedBefore: number; // segundos acumulados antes da pausa atual
  runningSince: number | null; // epoch ms (null = pausado)
  interruptions: number;
  cycle: number;
  phase: Phase;
  phaseSeconds: number; // duração planejada da fase atual
}

export function FocusTimer({ habits }: { habits: HabitRow[] }) {
  const [mode, setMode] = useState<Mode>("pomodoro");
  const [activity, setActivity] = useState("");
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState("25");
  const [avoidSocial, setAvoidSocial] = useState(false);
  const [habitId, setHabitId] = useState<string>("none");
  const [active, setActive] = useState<Active | null>(null);
  const [now, setNow] = useState(Date.now());
  const [note, setNote] = useState("");
  const [notif, setNotif] = useState<ReturnType<typeof localNotificationSupport>>("default");
  const lastBeat = useRef(0);

  // restaura sessão em andamento (recarregou a página / voltou ao app)
  useEffect(() => {
    setNotif(localNotificationSupport());
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setActive(JSON.parse(raw) as Active);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (active) localStorage.setItem(STORAGE_KEY, JSON.stringify(active));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, [active]);

  useEffect(() => {
    if (!active || !active.runningSince) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);

  const elapsed = active ? active.elapsedBefore + (active.runningSince ? (now - active.runningSince) / 1000 : 0) : 0;
  const totalFocus = useRef(0); // segundos de foco (sem pausas) acumulados nesta sessão
  const remaining = active && active.phase !== "idle" ? active.phaseSeconds - elapsed : 0;

  const notify = useCallback((title: string, body: string) => {
    playBeep();
    if (!showLocalNotification(title, body)) toast(title, { description: body });
  }, []);

  const finish = useCallback(
    async (completed: boolean, extra?: Partial<Active>) => {
      const a = active;
      if (!a) return;
      const focusSeconds = Math.round(totalFocus.current + (a.phase === "focus" ? Math.min(elapsed, a.phaseSeconds) : 0));
      setActive(null);
      const res = await finishFocusSession({ client_id: a.clientId, actual_seconds: focusSeconds, completed, interruptions: (extra?.interruptions ?? a.interruptions), note, ended_at: new Date().toISOString() });
      totalFocus.current = 0;
      setNote("");
      if (!res.ok) toast.error(res.error);
      else toast.success(completed ? `Sessão concluída: ${fmtClock(focusSeconds)} de foco.` : `Sessão encerrada: ${fmtClock(focusSeconds)} registrados.`);
    },
    [active, elapsed, note],
  );

  // transição de fases (pomodoro/custom/social_free)
  useEffect(() => {
    if (!active || active.phase === "idle" || active.mode === "stopwatch" || !active.runningSince) return;
    if (remaining > 0) return;
    if (active.phase === "focus") {
      totalFocus.current += active.phaseSeconds;
      if (active.mode === "pomodoro") {
        const nextCycle = active.cycle + 1;
        const long = nextCycle % POMODORO.cyclesBeforeLong === 0;
        notify(long ? "Pausa longa" : "Pausa curta", long ? `Descanse ${POMODORO.long} minutos.` : `Descanse ${POMODORO.short} minutos.`);
        setActive({ ...active, phase: long ? "long" : "short", cycle: nextCycle, phaseSeconds: (long ? POMODORO.long : POMODORO.short) * 60, elapsedBefore: 0, runningSince: Date.now() });
      } else {
        notify("Tempo concluído", `${active.activity}: meta de ${active.plannedMinutes} min atingida.`);
        setActive({ ...active, phase: "done", runningSince: null, elapsedBefore: active.phaseSeconds });
      }
    } else if (active.phase === "short" || active.phase === "long") {
      notify("Hora de voltar ao foco", `Ciclo ${active.cycle + 1}: ${active.activity}`);
      setActive({ ...active, phase: "focus", phaseSeconds: POMODORO.focus * 60, elapsedBefore: 0, runningSince: Date.now() });
    }
  }, [remaining, active, notify]);

  // heartbeat a cada 60s para não perder progresso
  useEffect(() => {
    if (!active || !active.runningSince || active.phase !== "focus") return;
    const t = setInterval(() => {
      if (Date.now() - lastBeat.current < 55000) return;
      lastBeat.current = Date.now();
      heartbeatFocusSession(active.clientId, totalFocus.current + Math.min(elapsed, active.phaseSeconds), active.interruptions);
    }, 60000);
    return () => clearInterval(t);
  }, [active, elapsed]);

  const start = async () => {
    const act = activity.trim();
    if (!act) return toast.error("Diga o que vai fazer nesta sessão.");
    const planned = mode === "pomodoro" ? POMODORO.focus : mode === "stopwatch" ? null : Math.max(1, Number(minutes) || 25);
    const clientId = uid();
    const startedAt = new Date().toISOString();
    const res = await startFocusSession({ client_id: clientId, activity: act, goal, mode, planned_minutes: planned, avoid_social: avoidSocial || mode === "social_free", habit_id: habitId === "none" ? null : habitId, started_at: startedAt });
    if (!res.ok) return toast.error(res.error);
    totalFocus.current = 0;
    setActive({ clientId, activity: act, goal, mode, plannedMinutes: planned, avoidSocial: avoidSocial || mode === "social_free", habitId: habitId === "none" ? null : habitId, startedAt: Date.now(), elapsedBefore: 0, runningSince: Date.now(), interruptions: 0, cycle: 0, phase: "focus", phaseSeconds: planned ? planned * 60 : Number.MAX_SAFE_INTEGER });
  };

  const pause = () => active && active.runningSince && setActive({ ...active, elapsedBefore: active.elapsedBefore + (Date.now() - active.runningSince) / 1000, runningSince: null });
  const resume = () => active && !active.runningSince && setActive({ ...active, runningSince: Date.now() });
  const interrupt = () => active && setActive({ ...active, interruptions: active.interruptions + 1 });

  if (active) {
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
            {active.phase !== "done" ? (
              active.runningSince ? <Button size="lg" variant="outline" onClick={pause}><Pause /> Pausar</Button> : <Button size="lg" variant="success" onClick={resume}><Play /> Retomar</Button>
            ) : null}
            {active.phase === "done" || (active.mode === "stopwatch") ? <Button size="lg" variant="success" onClick={() => finish(true)}><Square /> Concluir</Button> : <Button size="lg" variant="ghost" onClick={() => finish(false)}><Square /> Encerrar antes</Button>}
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

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="space-y-2">
        <Label>Modo</Label>
        <ToggleGroup type="single" value={mode} onValueChange={(v) => { if (!v) return; setMode(v as Mode); if (v === "social_free") { setAvoidSocial(true); setMinutes("60"); if (!activity) setActivity("Ficar 1 hora sem redes sociais"); } }}>
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
          <div className="space-y-2">
            <Label htmlFor="f-min">Quanto tempo (min)</Label>
            <Input id="f-min" type="number" min={1} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
        ) : null}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="f-goal">Objetivo (opcional)</Label>
          <Input id="f-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex.: terminar o capítulo 3" />
        </div>
        {habits.length ? (
          <div className="space-y-2 sm:col-span-3">
            <Label>Vincular a um hábito</Label>
            <Select value={habitId} onValueChange={setHabitId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {habits.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">Evitar redes sociais</p>
          <p className="text-xs text-muted-foreground">Compromisso declarado; o site não bloqueia outros apps.</p>
        </div>
        <Switch checked={avoidSocial || mode === "social_free"} disabled={mode === "social_free"} onCheckedChange={setAvoidSocial} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {notif === "default" ? (
          <Button variant="ghost" size="sm" onClick={async () => setNotif(await requestLocalPermission())}><Bell /> Permitir aviso ao terminar</Button>
        ) : notif === "denied" ? (
          <span className="text-xs text-muted-foreground">Notificações bloqueadas no navegador; usaremos som e aviso na tela.</span>
        ) : notif === "unsupported" ? (
          <span className="text-xs text-muted-foreground">Este navegador não exibe notificações; usaremos som e aviso na tela.</span>
        ) : <span className="text-xs text-muted-foreground">Aviso ao terminar ativado (com o site aberto).</span>}
        <Button size="lg" onClick={start}><Timer /> Começar</Button>
      </div>
    </div>
  );
}
