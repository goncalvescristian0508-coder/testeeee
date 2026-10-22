"use client";

import { useState, useTransition } from "react";
import { BedDouble, Moon, Pencil, Plus, Sunrise, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SleepGoalDialog } from "./sleep-goal-dialog";
import { SleepLogDialog } from "./sleep-log-dialog";
import { SleepConsistencyChart, SleepDurationChart } from "./sleep-charts";
import { deleteSleepLog } from "@/lib/actions/sleep";
import { averageSleep, consistency, goalMetCount, sleepMetrics, windDownTime } from "@/lib/sleep";
import type { SleepGoalRow, SleepLogRow } from "@/lib/database.types";
import { addDaysStr, fmtDate, normalizeTime, toTimeStr } from "@/lib/dates";
import { formatMinutes } from "@/lib/utils";

export function SleepView({ goal, logs, today, tz, habitsAligned }: { goal: SleepGoalRow; logs: SleepLogRow[]; today: string; tz: string; habitsAligned: { name: string; rate: number }[] }) {
  const [goalOpen, setGoalOpen] = useState(false);
  const [logOpen, setLogOpen] = useState<SleepLogRow | null | "new">(null);
  const [pending, start] = useTransition();

  const week = logs.filter((l) => l.date > addDaysStr(today, -7));
  const month = logs.filter((l) => l.date > addDaysStr(today, -30));
  const avgW = averageSleep(week);
  const avgM = averageSleep(month);
  const consW = consistency(week, goal, tz);
  const metW = goalMetCount(week, goal.target_hours);
  const metM = goalMetCount(month, goal.target_hours);
  const evening = (goal.evening_routine as { id: string; title: string }[]) ?? [];
  const morning = (goal.morning_routine as { id: string; title: string }[]) ?? [];

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteSleepLog(id);
      if (!res.ok) toast.error(res.error);
      else toast.success("Registro removido.");
    });

  return (
    <div className="space-y-6">
      <Alert variant="info">
        <Moon />
        <AlertDescription>Os registros de sono são manuais. O site não monitora seu sono automaticamente; os cálculos abaixo usam o que você informa.</AlertDescription>
      </Alert>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Dormir" value={normalizeTime(goal.bedtime)} hint={`desacelerar às ${windDownTime(normalizeTime(goal.bedtime), goal.wind_down_minutes)}`} icon={<Moon />} />
        <Stat label="Acordar" value={normalizeTime(goal.wake_time)} hint={`meta ${goal.target_hours}h`} icon={<Sunrise />} />
        <Stat label="Média 7 dias" value={avgW != null ? formatMinutes(avgW) : "—"} hint={week.length ? `${metW}/${week.length} noites na meta` : "sem registros"} tone={avgW != null && avgW >= goal.target_hours * 60 ? "success" : "default"} icon={<BedDouble />} />
        <Stat label="Média 30 dias" value={avgM != null ? formatMinutes(avgM) : "—"} hint={month.length ? `${metM}/${month.length} noites na meta` : "sem registros"} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setLogOpen("new")}><Plus /> Registrar noite</Button>
        <Button variant="outline" onClick={() => setGoalOpen(true)}><Pencil /> Metas e rotinas</Button>
      </div>

      <Tabs defaultValue="graficos">
        <TabsList>
          <TabsTrigger value="graficos">Gráficos</TabsTrigger>
          <TabsTrigger value="registros">Registros</TabsTrigger>
          <TabsTrigger value="rotinas">Rotinas</TabsTrigger>
        </TabsList>
        <TabsContent value="graficos" className="space-y-4">
          {month.length === 0 ? (
            <EmptyState icon={<BedDouble />} title="Nenhuma noite registrada" description="Registre a hora em que deitou, adormeceu e acordou para ver duração e consistência." action={<Button onClick={() => setLogOpen("new")}><Plus /> Registrar</Button>} />
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle>Duração do sono</CardTitle><CardDescription>Barras claras: tempo na cama. Barras verdes: tempo estimado dormindo (quando informado o horário em que adormeceu).</CardDescription></CardHeader>
                <CardContent><SleepDurationChart logs={month} targetHours={goal.target_hours} /></CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Consistência dos horários</CardTitle>
                  <CardDescription>
                    {consW.bedDeviation != null ? `Nos últimos 7 dias, você deitou em média ${consW.bedDeviation} min fora do horário planejado e acordou ${consW.wakeDeviation} min fora.` : "Linhas tracejadas: horários planejados."}
                  </CardDescription>
                </CardHeader>
                <CardContent><SleepConsistencyChart logs={month} goal={goal} tz={tz} /></CardContent>
              </Card>
              {habitsAligned.length ? (
                <Card>
                  <CardHeader><CardTitle>Hábitos ligados ao sono</CardTitle><CardDescription>Taxa de conclusão nos últimos 30 dias dos hábitos noturnos/matinais. Compare com a consistência acima.</CardDescription></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {habitsAligned.map((h) => (
                      <Badge key={h.name} variant={h.rate >= 70 ? "success" : "muted"}>{h.name}: {h.rate}%</Badge>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </TabsContent>
        <TabsContent value="registros" className="space-y-2">
          {logs.length === 0 ? <EmptyState title="Sem registros" /> : logs.map((l) => {
            const m = sleepMetrics(l);
            return (
              <div key={l.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{fmtDate(l.date, "EEE, d 'de' MMM")} <span className="text-muted-foreground">· {formatMinutes(m.asleepMin)} {m.hasAsleepData ? "dormindo" : "na cama"}</span></p>
                  <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>deitou {normalizeTime(toTimeStr(l.bed_at, tz))}</span>
                    {l.asleep_at ? <span>adormeceu {normalizeTime(toTimeStr(l.asleep_at, tz))}</span> : null}
                    <span>acordou {normalizeTime(toTimeStr(l.wake_at, tz))}</span>
                    {l.quality ? <span>qualidade {l.quality}/5</span> : null}
                    {l.awakenings ? <span>{l.awakenings} despertar{l.awakenings > 1 ? "es" : ""}</span> : null}
                  </p>
                  {l.notes ? <p className="text-xs italic text-muted-foreground">“{l.notes}”</p> : null}
                </div>
                {m.asleepMin >= goal.target_hours * 60 ? <Badge variant="success">meta</Badge> : null}
                <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setLogOpen(l)}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" aria-label="Excluir" disabled={pending} onClick={() => remove(l.id)}><Trash2 /></Button>
              </div>
            );
          })}
        </TabsContent>
        <TabsContent value="rotinas" className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Moon className="size-4" /> Rotina noturna</CardTitle><CardDescription>Começar às {windDownTime(normalizeTime(goal.bedtime), goal.wind_down_minutes)} ({goal.wind_down_minutes} min antes de dormir).</CardDescription></CardHeader>
            <CardContent>{evening.length ? <ol className="list-decimal space-y-1 pl-5 text-sm">{evening.map((s) => <li key={s.id}>{s.title}</li>)}</ol> : <p className="text-sm text-muted-foreground">Nenhum passo definido. Edite em “Metas e rotinas”.</p>}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sunrise className="size-4" /> Rotina matinal</CardTitle><CardDescription>Ao acordar às {normalizeTime(goal.wake_time)}.</CardDescription></CardHeader>
            <CardContent>{morning.length ? <ol className="list-decimal space-y-1 pl-5 text-sm">{morning.map((s) => <li key={s.id}>{s.title}</li>)}</ol> : <p className="text-sm text-muted-foreground">Nenhum passo definido. Edite em “Metas e rotinas”.</p>}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SleepGoalDialog open={goalOpen} onOpenChange={setGoalOpen} goal={goal} />
      <SleepLogDialog open={!!logOpen} onOpenChange={(v) => !v && setLogOpen(null)} log={logOpen === "new" ? null : logOpen} goal={goal} today={today} tz={tz} />
    </div>
  );
}
