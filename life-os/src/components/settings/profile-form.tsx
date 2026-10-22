"use client";

import { useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveProfile } from "@/lib/actions/settings";
import type { HabitRow, ProfileRow } from "@/lib/database.types";
import { DEFAULT_PERIODS, WEEKDAY_LONG, type DayPeriods } from "@/lib/dates";

const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Belem", "America/Fortaleza", "America/Recife", "America/Bahia", "America/Cuiaba", "America/Campo_Grande", "America/Porto_Velho", "America/Rio_Branco", "America/Noronha", "America/Lisbon", "Europe/London", "America/New_York", "America/Los_Angeles"];

export function ProfileForm({ profile, habits }: { profile: ProfileRow; habits: HabitRow[] }) {
  const { setTheme } = useTheme();
  const [name, setName] = useState(profile.display_name ?? "");
  const [tz, setTz] = useState(profile.timezone);
  const [week, setWeek] = useState(String(profile.week_starts_on));
  const [theme, setThemeValue] = useState<ProfileRow["theme"]>(profile.theme);
  const [periods, setPeriods] = useState<DayPeriods>({ ...DEFAULT_PERIODS, ...((profile.day_periods as Partial<DayPeriods>) ?? {}) });
  const [ids, setIds] = useState<string[]>(profile.dashboard_habit_ids ?? []);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await saveProfile({ display_name: name, timezone: tz, week_starts_on: Number(week), theme, day_periods: periods, dashboard_habit_ids: ids });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTheme(theme);
      toast.success("Perfil salvo.");
    });

  return (
    <Card>
      <CardHeader><CardTitle>Perfil e preferências</CardTitle><CardDescription>Nome, fuso horário, tema e como o dia é dividido.</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="p-name">Nome</Label><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Fuso horário</Label>
            <Select value={tz} onValueChange={setTz}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[...new Set([tz, ...TIMEZONES])].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Início da semana</Label>
            <Select value={week} onValueChange={setWeek}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 0, 6].map((d) => <SelectItem key={d} value={String(d)}>{WEEKDAY_LONG[d]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tema</Label>
            <ToggleGroup type="single" value={theme} onValueChange={(v) => { if (v) { setThemeValue(v as ProfileRow["theme"]); setTheme(v); } }}>
              <ToggleGroupItem value="dark">Escuro</ToggleGroupItem>
              <ToggleGroupItem value="light">Claro</ToggleGroupItem>
              <ToggleGroupItem value="system">Sistema</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Períodos do dia</Label>
          <p className="text-xs text-muted-foreground">Define quando começam manhã, tarde e noite na timeline e na classificação automática de hábitos.</p>
          <div className="grid grid-cols-3 gap-3">
            {(["morning", "afternoon", "evening"] as const).map((p) => (
              <div key={p} className="space-y-1"><Label htmlFor={`per-${p}`} className="text-xs">{{ morning: "Manhã", afternoon: "Tarde", evening: "Noite" }[p]} a partir de</Label><Input id={`per-${p}`} type="time" value={periods[p]} onChange={(e) => setPeriods({ ...periods, [p]: e.target.value })} /></div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Hábitos exibidos na tela inicial</Label>
          <p className="text-xs text-muted-foreground">Nenhum selecionado = usa a opção “mostrar na tela inicial” de cada hábito.</p>
          {habits.length ? (
            <div className="grid gap-1.5 rounded-lg border border-border p-2 sm:grid-cols-2">
              {habits.map((h) => (
                <label key={h.id} className="flex items-center gap-2 text-sm"><Checkbox checked={ids.includes(h.id)} onCheckedChange={(c) => setIds(c ? [...ids, h.id] : ids.filter((x) => x !== h.id))} /><span className="truncate">{h.name}</span></label>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">Nenhum hábito ativo.</p>}
        </div>
        <div className="flex justify-end"><Button onClick={save} loading={pending}>Salvar</Button></div>
      </CardContent>
    </Card>
  );
}
