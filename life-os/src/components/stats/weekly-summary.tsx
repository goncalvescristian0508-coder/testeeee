import { ArrowDownRight, ArrowUpRight, Lightbulb, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { WeeklySummary } from "@/lib/stats";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function WeeklySummaryCard({ summary }: { summary: WeeklySummary }) {
  const { current, improved, worsened, consistentHabits, inconsistentHabits, postponed, suggestion, trends } = summary;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo da semana</CardTitle>
        <CardDescription>{fmtDate(current.from, "d MMM")} – {fmtDate(current.to, "d MMM")}, comparado com a semana anterior. Gerado por regras, sem inteligência artificial.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {trends.map((t) => {
            const good = t.delta === 0 ? null : t.positiveIsGood ? t.delta > 0 : t.delta < 0;
            return (
              <Badge key={t.label} variant={good == null ? "muted" : good ? "success" : "destructive"}>
                {t.delta === 0 ? <Minus /> : t.delta > 0 ? <ArrowUpRight /> : <ArrowDownRight />}
                {t.label} {t.delta > 0 ? "+" : ""}{t.delta}{t.unit}
              </Badge>
            );
          })}
          {trends.length === 0 ? <span className="text-sm text-muted-foreground">Ainda não há duas semanas de dados para comparar.</span> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Section title="O que melhorou" icon={<TrendingUp className="size-4 text-success" />} items={improved} empty="Nada se destacou ainda." />
          <Section title="O que piorou" icon={<TrendingDown className="size-4 text-destructive" />} items={worsened} empty="Nada piorou de forma relevante." />
          <Section title="Hábitos mais consistentes" items={consistentHabits.map((h) => `${h.name} (${h.rate}%)`)} empty="Nenhum hábito com 80% ou mais nas duas últimas semanas." />
          <Section title="Frequentemente adiado" items={[...postponed.map((p) => `${p.title} (${p.count}x)`), ...inconsistentHabits.map((h) => `${h.name} (${h.rate}%)`)]} empty="Nada foi adiado repetidamente." />
        </div>
        <div className={cn("flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4")}>
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <p className="text-sm font-medium">Sugestão para a próxima semana</p>
            <p className="text-sm text-muted-foreground">{suggestion}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({ title, icon, items, empty }: { title: string; icon?: React.ReactNode; items: string[]; empty: string }) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">{icon}{title}</h4>
      {items.length ? <ul className="space-y-1 text-sm text-muted-foreground">{items.map((i) => <li key={i}>• {i}</li>)}</ul> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </div>
  );
}
