"use client";

import { useEffect, useState, useTransition } from "react";
import { Info, Pencil, Plus, Smartphone, Target, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScreenTimeStackedChart } from "./screen-time-charts";
import { deleteScreenTimeLog, saveScreenTimeGoals, saveScreenTimeLog } from "@/lib/actions/screen-time";
import { APPS, average, entriesOf, isExcessive, SOURCE_LABEL, type AppKey } from "@/lib/screen-time";
import type { ScreenTimeGoalRow, ScreenTimeLogRow } from "@/lib/database.types";
import { addDaysStr, fmtDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/utils";

interface Props {
  logs: ScreenTimeLogRow[];
  goals: ScreenTimeGoalRow[];
  today: string;
  socialFreeMinutes7d: number;
}

export function ScreenTimeView({ logs, goals, today, socialFreeMinutes7d }: Props) {
  const [logOpen, setLogOpen] = useState<ScreenTimeLogRow | null | "new">(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [pending, start] = useTransition();

  const manual = logs.filter((l) => l.source === "manual");
  const goalMap = new Map(goals.map((g) => [g.app, g.max_minutes]));
  const goalTotal = goalMap.get("total") ?? null;
  const todayLog = manual.find((l) => l.date === today) ?? null;
  const last7 = manual.filter((l) => l.date > addDaysStr(today, -7));
  const prev7 = manual.filter((l) => l.date > addDaysStr(today, -14) && l.date <= addDaysStr(today, -7));
  const avg7 = average(last7.map((l) => l.total_minutes));
  const avgPrev = average(prev7.map((l) => l.total_minutes));
  const delta = avg7 != null && avgPrev != null ? Math.round(avg7 - avgPrev) : null;
  const excessiveDays = manual.filter((l) => l.date > addDaysStr(today, -30) && isExcessive(l.total_minutes, goalTotal));
  const consciousDays = manual.filter((l) => l.date > addDaysStr(today, -30) && l.conscious_use).length;
  const firstWeekAvg = average(manual.filter((l) => l.date > addDaysStr(today, -30) && l.date <= addDaysStr(today, -23)).map((l) => l.total_minutes));
  const reduction = firstWeekAvg != null && avg7 != null && firstWeekAvg > 0 ? Math.round(((firstWeekAvg - avg7) / firstWeekAvg) * 100) : null;

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteScreenTimeLog(id);
      if (!res.ok) toast.error(res.error);
    });

  return (
    <div className="space-y-6">
      <Alert variant="info">
        <Info />
        <AlertTitle>De onde vêm estes dados</AlertTitle>
        <AlertDescription>
          Um site não tem acesso ao Tempo de Uso do iPhone nem ao tempo em outros apps. Tudo aqui é <strong>informado manualmente</strong> por você (consulte Ajustes › Tempo de Uso no iPhone e copie os valores). As sessões de foco são <strong>medidas neste site</strong> e aparecem em separado. Uma integração nativa futura seria marcada como <strong>importada</strong>.
        </AlertDescription>
      </Alert>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Hoje (informado)" value={todayLog ? formatMinutes(todayLog.total_minutes) : "—"} hint={todayLog ? (goalTotal ? `meta ${formatMinutes(goalTotal)}` : "sem meta total") : "ainda não informado"} icon={<Smartphone />} tone={todayLog && goalTotal && todayLog.total_minutes > goalTotal ? "destructive" : "default"} />
        <Stat label="Média 7 dias" value={avg7 != null ? formatMinutes(avg7) : "—"} hint={delta != null ? <span className={delta <= 0 ? "text-success" : "text-destructive"}>{delta <= 0 ? <TrendingDown className="inline size-3" /> : <TrendingUp className="inline size-3" />} {Math.abs(delta)} min vs. semana anterior</span> : "compare com a semana anterior"} />
        <Stat label="Redução (30d)" value={reduction != null ? `${reduction > 0 ? "-" : "+"}${Math.abs(reduction)}%` : "—"} hint="1ª semana vs. última" tone={reduction != null && reduction > 0 ? "success" : "default"} />
        <Stat label="Sem redes (7d)" value={formatMinutes(socialFreeMinutes7d)} hint="sessões voluntárias medidas no site" tone={socialFreeMinutes7d > 0 ? "success" : "default"} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setLogOpen(todayLog ?? "new")}>{todayLog ? <><Pencil /> Editar hoje</> : <><Plus /> Informar hoje</>}</Button>
        <Button variant="outline" onClick={() => setGoalsOpen(true)}><Target /> Metas por app</Button>
      </div>

      {goals.length ? (
        <Card>
          <CardHeader><CardTitle>Hoje vs. metas</CardTitle><CardDescription>Limites diários definidos por você.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {[...APPS.map((a) => ({ key: a.key as string, label: a.label })), { key: "total", label: "Total" }].filter((a) => goalMap.has(a.key)).map((a) => {
              const used = a.key === "total" ? (todayLog?.total_minutes ?? 0) : ((todayLog ? entriesOf(todayLog)[a.key as AppKey] : 0) ?? 0);
              const max = goalMap.get(a.key)!;
              const pct = Math.min(100, Math.round((used / max) * 100));
              return (
                <div key={a.key} className="space-y-1">
                  <div className="flex justify-between text-sm"><span>{a.label}</span><span className={used > max ? "text-destructive" : "text-muted-foreground"}>{formatMinutes(used)} / {formatMinutes(max)}</span></div>
                  <Progress value={pct} indicatorClassName={used > max ? "bg-destructive" : pct > 80 ? "bg-warning" : undefined} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="semana">
        <TabsList>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">30 dias</TabsTrigger>
          <TabsTrigger value="hist">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="semana">
          {last7.length === 0 ? <EmptyState icon={<Smartphone />} title="Nenhum registro nos últimos 7 dias" description="Informe o tempo de tela de hoje para começar a acompanhar." action={<Button onClick={() => setLogOpen("new")}><Plus /> Informar</Button>} /> : (
            <Card><CardHeader><CardTitle>Tempo por app</CardTitle><CardDescription>Dados informados manualmente. Linha tracejada: meta total.</CardDescription></CardHeader><CardContent><ScreenTimeStackedChart logs={manual} from={addDaysStr(today, -6)} to={today} goalTotal={goalTotal} /></CardContent></Card>
          )}
        </TabsContent>
        <TabsContent value="mes" className="space-y-4">
          <Card><CardHeader><CardTitle>Últimos 30 dias</CardTitle></CardHeader><CardContent><ScreenTimeStackedChart logs={manual} from={addDaysStr(today, -29)} to={today} goalTotal={goalTotal} /></CardContent></Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Períodos de uso excessivo</CardTitle><CardDescription>Dias acima da meta total{goalTotal ? "" : " (ou de 3h, sem meta definida)"}.</CardDescription></CardHeader>
              <CardContent>{excessiveDays.length ? <div className="flex flex-wrap gap-1.5">{excessiveDays.map((l) => <Badge key={l.id} variant="destructive">{fmtDate(l.date, "d MMM")} · {formatMinutes(l.total_minutes)}</Badge>)}</div> : <p className="text-sm text-muted-foreground">Nenhum nos últimos 30 dias.</p>}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Uso consciente</CardTitle><CardDescription>Dias que você marcou como uso intencional das redes.</CardDescription></CardHeader>
              <CardContent><p className="text-2xl font-semibold">{consciousDays} <span className="text-sm font-normal text-muted-foreground">dias em 30</span></p></CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="hist" className="space-y-2">
          {logs.length === 0 ? <EmptyState title="Sem histórico" /> : logs.map((l) => {
            const e = entriesOf(l);
            return (
              <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{fmtDate(l.date, "EEE, d 'de' MMM")} <span className="text-muted-foreground">· {formatMinutes(l.total_minutes)}</span></p>
                  <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    {APPS.filter((a) => e[a.key]).map((a) => <span key={a.key}>{a.label} {e[a.key]}m</span>)}
                    {l.notes ? <span className="italic">“{l.notes}”</span> : null}
                  </p>
                </div>
                <Badge variant="muted">{SOURCE_LABEL[l.source]}</Badge>
                {l.conscious_use ? <Badge variant="success">consciente</Badge> : null}
                {isExcessive(l.total_minutes, goalTotal) ? <Badge variant="destructive">excessivo</Badge> : null}
                {l.source === "manual" ? <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setLogOpen(l)}><Pencil /></Button> : null}
                <Button variant="ghost" size="icon-sm" aria-label="Excluir" disabled={pending} onClick={() => remove(l.id)}><Trash2 /></Button>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

      <ScreenTimeLogDialog open={!!logOpen} onOpenChange={(v) => !v && setLogOpen(null)} log={logOpen === "new" ? null : logOpen} today={today} />
      <GoalsDialog open={goalsOpen} onOpenChange={setGoalsOpen} goals={goals} />
    </div>
  );
}

function ScreenTimeLogDialog({ open, onOpenChange, log, today }: { open: boolean; onOpenChange: (o: boolean) => void; log: ScreenTimeLogRow | null; today: string }) {
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [conscious, setConscious] = useState(false);
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!open) return;
    const e = log ? entriesOf(log) : {};
    setDate(log?.date ?? today);
    setValues(Object.fromEntries(APPS.map((a) => [a.key, e[a.key] ? String(e[a.key]) : ""])));
    setConscious(log?.conscious_use ?? false);
    setNotes(log?.notes ?? "");
  }, [open, log, today]);
  const total = APPS.reduce((a, k) => a + (Number(values[k.key]) || 0), 0);
  const save = () =>
    start(async () => {
      const res = await saveScreenTimeLog({ date, entries: Object.fromEntries(APPS.map((a) => [a.key, Number(values[a.key]) || 0])), conscious_use: conscious, notes });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Tempo de tela registrado.");
      onOpenChange(false);
    });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tempo de tela (manual)</DialogTitle>
          <DialogDescription>Minutos por app. No iPhone: Ajustes › Tempo de Uso › Ver toda a atividade.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="st-date">Dia</Label><Input id="st-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} disabled={!!log} /></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {APPS.map((a) => (
              <div key={a.key} className="space-y-1"><Label htmlFor={`st-${a.key}`}>{a.label} (min)</Label><Input id={`st-${a.key}`} type="number" inputMode="numeric" min={0} max={1440} value={values[a.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [a.key]: e.target.value }))} /></div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Total: <span className="font-medium text-foreground">{formatMinutes(total)}</span></p>
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
            <div><p className="text-sm font-medium">Uso consciente das redes</p><p className="text-xs text-muted-foreground">Hoje usei com intenção, não no automático.</p></div>
            <Switch checked={conscious} onCheckedChange={setConscious} />
          </div>
          <div className="space-y-2"><Label htmlFor="st-notes">Observações</Label><Textarea id="st-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save} loading={pending}>Salvar</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoalsDialog({ open, onOpenChange, goals }: { open: boolean; onOpenChange: (o: boolean) => void; goals: ScreenTimeGoalRow[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  useEffect(() => {
    if (open) setValues(Object.fromEntries([...APPS.map((a) => a.key), "total"].map((k) => [k, String(goals.find((g) => g.app === k)?.max_minutes ?? "")])));
  }, [open, goals]);
  const save = () =>
    start(async () => {
      const res = await saveScreenTimeGoals(Object.entries(values).map(([app, v]) => ({ app, max_minutes: Number(v) || 0 })));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Metas salvas.");
      onOpenChange(false);
    });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Metas diárias</DialogTitle><DialogDescription>Limite máximo por app, em minutos. Deixe vazio para não definir.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          {[...APPS, { key: "total", label: "Total do dia" }].map((a) => (
            <div key={a.key} className="flex items-center justify-between gap-3"><Label htmlFor={`g-${a.key}`}>{a.label}</Label><Input id={`g-${a.key}`} type="number" min={0} max={1440} className="w-28" value={values[a.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [a.key]: e.target.value }))} /></div>
          ))}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save} loading={pending}>Salvar</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
