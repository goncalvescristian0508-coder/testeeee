"use client";

import { CalendarDays, MapPin, Repeat } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { EventOccurrence } from "@/lib/data/events";
import type { CategoryRow } from "@/lib/database.types";
import { fmtDate, normalizeTime, relativeDayLabel, toDateStr, toTimeStr } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function UpcomingList({ occurrences, categories, tz, today, onSelect }: { occurrences: EventOccurrence[]; categories: CategoryRow[]; tz: string; today: string; onSelect: (o: EventOccurrence) => void }) {
  const nowIso = new Date().toISOString();
  const upcoming = occurrences.filter((o) => o.end_at >= nowIso);
  if (!upcoming.length) return <EmptyState icon={<CalendarDays />} title="Nenhum compromisso nos próximos 30 dias" description="Adicione reuniões, consultas, blocos de tempo ou atividades recorrentes." />;
  const groups = new Map<string, EventOccurrence[]>();
  for (const o of upcoming) {
    const d = toDateStr(o.start_at, tz);
    groups.set(d, [...(groups.get(d) ?? []), o]);
  }
  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([d, list]) => (
        <section key={d}>
          <h3 className={cn("mb-2 text-xs font-medium uppercase tracking-wider", d === today ? "text-success" : "text-muted-foreground")}>
            {relativeDayLabel(d, today)} · {fmtDate(d, "d 'de' MMMM")}
          </h3>
          <div className="space-y-2">
            {list.map((o) => {
              const cat = categories.find((c) => c.id === o.source.category_id);
              return (
                <button key={o.key} type="button" onClick={() => onSelect(o)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent/50">
                  <span className="w-14 shrink-0 text-sm tabular-nums text-muted-foreground">{o.source.all_day ? "Dia" : normalizeTime(toTimeStr(o.start_at, tz))}</span>
                  <span className="h-8 w-1 rounded-full" style={{ backgroundColor: cat?.color ?? "#38bdf8" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{o.source.title}</span>
                    <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                      {!o.source.all_day ? <span>até {normalizeTime(toTimeStr(o.end_at, tz))}</span> : null}
                      {o.source.location ? <span className="flex items-center gap-0.5"><MapPin className="size-3" />{o.source.location}</span> : null}
                      {o.isRecurring ? <span className="flex items-center gap-0.5"><Repeat className="size-3" />recorrente</span> : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
