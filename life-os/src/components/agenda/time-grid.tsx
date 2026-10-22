"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { moveOccurrence } from "@/lib/actions/events";
import type { EventOccurrence } from "@/lib/data/events";
import type { TaskWithSubtasks } from "@/lib/data/tasks";
import type { CategoryRow } from "@/lib/database.types";
import { addDaysStr, fmtDate, localToIso, normalizeTime, timeToMinutes, toDateStr, toTimeStr, weekdayOf, WEEKDAY_LABELS } from "@/lib/dates";
import { cn } from "@/lib/utils";
import Link from "next/link";

const HOUR_PX = 56;
const SNAP = 15;

interface Props {
  days: string[]; // datas locais das colunas
  occurrences: EventOccurrence[];
  tasks: TaskWithSubtasks[];
  categories: CategoryRow[];
  tz: string;
  today: string;
  nowMinutes: number;
  onSelect: (o: EventOccurrence) => void;
  onCreate: (date: string, time: string) => void;
}

interface Drag {
  key: string;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  moved: boolean;
}

/** Grade horária (dia/semana) com arrastar para remarcar. */
export function TimeGrid({ days, occurrences, tasks, categories, tz, today, nowMinutes, onSelect, onCreate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, { start_at: string; end_at: string }>>({});

  useEffect(() => {
    // rola para o horário atual (ou 7h) na montagem
    const el = scrollRef.current;
    if (!el) return;
    const target = days.includes(today) ? Math.max(0, (nowMinutes - 90) / 60) : 7;
    el.scrollTop = target * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colWidth = () => (colRef.current?.getBoundingClientRect().width ?? 0) / days.length;

  const endDrag = async (o: EventOccurrence, d: Drag) => {
    setDrag(null);
    if (!d.moved) {
      onSelect(o);
      return;
    }
    const deltaMin = Math.round((d.dy / HOUR_PX) * 60 / SNAP) * SNAP;
    const deltaDays = days.length > 1 ? Math.round(d.dx / colWidth()) : 0;
    if (deltaMin === 0 && deltaDays === 0) return;
    const date = addDaysStr(toDateStr(o.start_at, tz), deltaDays);
    const startMin = Math.min(1440 - SNAP, Math.max(0, timeToMinutes(toTimeStr(o.start_at, tz)) + deltaMin));
    const duration = (new Date(o.end_at).getTime() - new Date(o.start_at).getTime()) / 60000;
    const newStart = localToIso(date, minutesToHHMM(startMin), tz);
    const newEnd = new Date(new Date(newStart).getTime() + duration * 60000).toISOString();
    setOptimistic((s) => ({ ...s, [o.key]: { start_at: newStart, end_at: newEnd } }));
    const res = await moveOccurrence(o.source.id, o.originalDate, newStart, newEnd);
    if (!res.ok) {
      toast.error(res.error);
      setOptimistic((s) => {
        const c = { ...s };
        delete c[o.key];
        return c;
      });
    } else toast.success(`Remarcado para ${fmtDate(date, "EEE d MMM")} às ${minutesToHHMM(startMin)}.`);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* cabeçalho */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <div key={d} className={cn("border-l border-border px-1 py-2 text-center", d === today && "bg-success/5")}>
            <div className="text-[11px] uppercase text-muted-foreground">{WEEKDAY_LABELS[weekdayOf(d)]}</div>
            <div className={cn("mx-auto flex size-7 items-center justify-center rounded-full text-sm font-medium", d === today && "bg-success text-success-foreground")}>{Number(d.slice(8, 10))}</div>
          </div>
        ))}
      </div>
      {/* dia inteiro + tarefas */}
      {(occurrences.some((o) => o.source.all_day) || tasks.length > 0) && (
        <div className="grid border-b border-border" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="py-1 pr-1 text-right text-[10px] text-muted-foreground">dia</div>
          {days.map((d) => (
            <div key={d} className="min-h-8 space-y-1 border-l border-border p-1">
              {occurrences.filter((o) => o.source.all_day && toDateStr(o.start_at, tz) === d).map((o) => (
                <button key={o.key} type="button" onClick={() => onSelect(o)} className="block w-full truncate rounded-md bg-chart-4/20 px-1.5 py-0.5 text-left text-[11px] font-medium text-chart-4">{o.source.title}</button>
              ))}
              {tasks.filter((t) => t.due_date === d).map((t) => (
                <Link key={t.id} href="/tarefas" className={cn("block w-full truncate rounded-md border border-dashed px-1.5 py-0.5 text-[11px]", t.status === "done" ? "border-border text-muted-foreground line-through" : t.due_date! < today ? "border-destructive/50 text-destructive" : "border-border")}>
                  {t.due_time ? `${normalizeTime(t.due_time)} ` : ""}{t.title}
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
      {/* grade */}
      <div ref={scrollRef} className="relative max-h-[65dvh] overflow-y-auto scrollbar-thin">
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`, height: 24 * HOUR_PX }}>
          <div className="relative">
            {hours.map((h) => (
              <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: h * HOUR_PX }}>
                {h > 0 ? `${String(h).padStart(2, "0")}:00` : ""}
              </div>
            ))}
          </div>
          <div ref={colRef} className="relative grid" style={{ gridColumn: `2 / span ${days.length}`, gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d) => (
              <div
                key={d}
                className={cn("relative border-l border-border", d === today && "bg-success/[0.03]")}
                onDoubleClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const min = Math.floor(((e.clientY - rect.top) / HOUR_PX) * 60 / 30) * 30;
                  onCreate(d, minutesToHHMM(min));
                }}
              >
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: h * HOUR_PX }} />
                ))}
                {d === today ? <div className="pointer-events-none absolute inset-x-0 z-10 h-px bg-destructive" style={{ top: (nowMinutes / 60) * HOUR_PX }}><span className="absolute -left-1 -top-1 size-2 rounded-full bg-destructive" /></div> : null}
                {layout(occurrences.filter((o) => !o.source.all_day && toDateStr((optimistic[o.key] ?? o).start_at, tz) === d).map((o) => ({ o, ...(optimistic[o.key] ?? { start_at: o.start_at, end_at: o.end_at }) })), tz).map(({ o, start_at, end_at, col, cols }) => {
                  const startMin = timeToMinutes(toTimeStr(start_at, tz));
                  const dur = Math.max(20, (new Date(end_at).getTime() - new Date(start_at).getTime()) / 60000);
                  const cat = categories.find((c) => c.id === o.source.category_id);
                  const color = cat?.color ?? (o.source.priority === 1 ? "#ef4444" : "#38bdf8");
                  const isDragging = drag?.key === o.key;
                  return (
                    <div
                      key={o.key}
                      role="button"
                      tabIndex={0}
                      aria-label={`${o.source.title}, ${normalizeTime(toTimeStr(start_at, tz))}`}
                      onKeyDown={(e) => e.key === "Enter" && onSelect(o)}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        setDrag({ key: o.key, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false });
                      }}
                      onPointerMove={(e) => {
                        if (!drag || drag.key !== o.key) return;
                        const dx = e.clientX - drag.startX;
                        const dy = e.clientY - drag.startY;
                        setDrag({ ...drag, dx, dy, moved: drag.moved || Math.abs(dx) > 5 || Math.abs(dy) > 5 });
                      }}
                      onPointerUp={() => drag && drag.key === o.key && endDrag(o, drag)}
                      onPointerCancel={() => setDrag(null)}
                      className={cn(
                        "absolute z-[5] overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-[11px] leading-tight shadow-sm transition-shadow select-none touch-none",
                        isDragging ? "z-20 cursor-grabbing opacity-90 shadow-xl ring-2 ring-foreground/30" : "cursor-grab hover:shadow-md",
                        o.moved && "border-dashed",
                      )}
                      style={{
                        top: (startMin / 60) * HOUR_PX + 1,
                        height: (dur / 60) * HOUR_PX - 2,
                        left: `calc(${(col / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        backgroundColor: color + "26",
                        borderLeftColor: color,
                        transform: isDragging ? `translate(${drag.dx}px, ${Math.round(((drag.dy / HOUR_PX) * 60) / SNAP) * SNAP * (HOUR_PX / 60)}px)` : undefined,
                      }}
                    >
                      <div className="truncate font-medium">{o.source.title}</div>
                      <div className="truncate text-[10px] opacity-80">
                        {normalizeTime(toTimeStr(start_at, tz))} – {normalizeTime(toTimeStr(end_at, tz))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">Arraste para remarcar · toque duas vezes em um horário para criar.</p>
    </div>
  );
}

function minutesToHHMM(m: number) {
  const x = Math.max(0, Math.min(1439, m));
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
}

/** Distribui eventos sobrepostos em colunas lado a lado. */
function layout<T extends { start_at: string; end_at: string }>(items: T[], tz: string) {
  const sorted = [...items].sort((a, b) => a.start_at.localeCompare(b.start_at));
  const result: (T & { col: number; cols: number })[] = [];
  let cluster: (T & { col: number; cols: number })[] = [];
  let clusterEnd = "";
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) c.cols = cols;
    result.push(...cluster);
    cluster = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.start_at >= clusterEnd) flush();
    const taken = new Set(cluster.filter((c) => c.end_at > it.start_at).map((c) => c.col));
    let col = 0;
    while (taken.has(col)) col++;
    cluster.push({ ...it, col, cols: 1 });
    if (!clusterEnd || it.end_at > clusterEnd) clusterEnd = it.end_at;
  }
  flush();
  void tz;
  return result;
}
