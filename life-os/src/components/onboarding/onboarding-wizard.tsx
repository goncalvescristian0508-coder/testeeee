"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Check, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { completeOnboarding, skipOnboarding } from "@/lib/actions/onboarding";
import { EXAMPLE_ROUTINE, type ExampleHabit } from "@/lib/onboarding/example-routine";
import { iconFor } from "@/lib/icons";
import { PERIOD_LABEL } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Row = ExampleHabit & { enabled: boolean };

export function OnboardingWizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [bedtime, setBedtime] = useState("23:00");
  const [wake, setWake] = useState("07:00");
  const [hours, setHours] = useState("8");
  const [rows, setRows] = useState<Row[]>(EXAMPLE_ROUTINE.map((h) => ({ ...h, enabled: true })));
  const [pending, start] = useTransition();

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const finish = () =>
    start(async () => {
      const res = await completeOnboarding({
        display_name: name,
        bedtime,
        wake_time: wake,
        target_hours: Number(hours),
        habits: rows.filter((r) => r.enabled).map((r) => ({ name: r.name, icon: r.icon, color: r.color, period: r.period, time: r.time, kind: r.kind, target: r.target ?? null, unit: r.unit ?? null, minutes: r.minutes ?? null })),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Tudo pronto. Bem-vindo ao Life OS.");
      router.replace("/dashboard");
    });

  const steps = ["Você", "Sono", "Rotina"];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {steps.map((s, i) => (
          <span key={s} className={cn("flex items-center gap-2", i === step && "text-foreground font-medium")}>
            <span className={cn("flex size-6 items-center justify-center rounded-full border text-xs", i < step ? "border-success bg-success text-success-foreground" : i === step ? "border-foreground" : "border-border")}>{i < step ? <Check className="size-3" /> : i + 1}</span>
            {s}
            {i < steps.length - 1 ? <span className="mx-1 h-px w-6 bg-border" /> : null}
          </span>
        ))}
      </div>

      {step === 0 ? (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-success/15 text-success"><Sprout className="size-5" /></span>
            <div>
              <h1 className="text-xl font-semibold">Vamos montar sua base</h1>
              <p className="text-sm text-muted-foreground">Leva menos de dois minutos. Tudo pode ser mudado depois.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ob-name">Como quer ser chamado?</Label>
            <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <p className="text-xs text-muted-foreground">Fuso horário: America/Sao_Paulo (ajustável em Configurações).</p>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <div>
            <h1 className="text-xl font-semibold">Seus horários de sono</h1>
            <p className="text-sm text-muted-foreground">Usamos isso para lembretes e para medir a consistência. Nada é presumido.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ob-bed">Dormir</Label>
              <Input id="ob-bed" type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-wake">Acordar</Label>
              <Input id="ob-wake" type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-hours">Meta (h)</Label>
              <Input id="ob-hours" type="number" min={4} max={12} step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-5 rounded-2xl border border-border bg-card p-6">
          <div>
            <h1 className="text-xl font-semibold">Rotina de exemplo</h1>
            <p className="text-sm text-muted-foreground">Desmarque o que não faz sentido e ajuste horários e nomes. Você pode criar outros hábitos depois.</p>
          </div>
          {(["morning", "afternoon", "evening"] as const).map((p) => (
            <div key={p} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{PERIOD_LABEL[p]}</h2>
              {rows.filter((r) => r.period === p).map((r) => {
                const Icon = iconFor(r.icon);
                return (
                  <div key={r.key} className={cn("flex items-center gap-3 rounded-xl border border-border px-3 py-2", !r.enabled && "opacity-50")}>
                    <Checkbox checked={r.enabled} onCheckedChange={(c) => update(r.key, { enabled: c === true })} aria-label={`Incluir ${r.name}`} />
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: r.color + "22", color: r.color }}><Icon className="size-4" /></span>
                    <Input value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} className="h-9 flex-1" aria-label="Nome do hábito" />
                    <Input type="time" value={r.time} onChange={(e) => update(r.key, { time: e.target.value })} className="h-9 w-28" aria-label="Horário" />
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          {step > 0 ? <Button variant="ghost" onClick={() => setStep((s) => s - 1)}><ArrowLeft /> Voltar</Button> : <Button variant="ghost" onClick={() => start(() => skipOnboarding())} disabled={pending}>Pular por agora</Button>}
        </div>
        {step < 2 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !name.trim()}>Continuar <ArrowRight /></Button>
        ) : (
          <Button onClick={finish} loading={pending} variant="success">Concluir</Button>
        )}
      </div>
    </div>
  );
}
