"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BookOpen, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { deleteJournalEntry, saveJournalEntry } from "@/lib/actions/journal";
import type { JournalEntryRow } from "@/lib/database.types";
import { fmtDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const MOOD = ["😞", "😕", "😐", "🙂", "😄"];
const ENERGY = ["Esgotado", "Baixa", "Média", "Boa", "Alta"];

export function JournalView({ entries, selected, date, today, query }: { entries: JournalEntryRow[]; selected: JournalEntryRow | null; date: string; today: string; query: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(query);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState("");
  const [good, setGood] = useState("");
  const [improve, setImprove] = useState("");
  const [learn, setLearn] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setContent(selected?.content ?? "");
    setMood(selected?.mood ? String(selected.mood) : "");
    setEnergy(selected?.energy ? String(selected.energy) : "");
    setGood(selected?.good_things ?? "");
    setImprove(selected?.improve ?? "");
    setLearn(selected?.learnings ?? "");
    setTomorrow(selected?.tomorrow_priorities ?? "");
    setDirty(false);
  }, [selected, date]);

  const go = (next: { date?: string; q?: string }) => {
    const p = new URLSearchParams(params.toString());
    if (next.date !== undefined) p.set("data", next.date);
    if (next.q !== undefined) {
      if (next.q) p.set("q", next.q);
      else p.delete("q");
    }
    router.replace(`/diario?${p.toString()}`, { scroll: false });
  };

  const save = () =>
    start(async () => {
      const res = await saveJournalEntry({ date, content, mood: mood ? Number(mood) : null, energy: energy ? Number(energy) : null, good_things: good, improve, learnings: learn, tomorrow_priorities: tomorrow });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Entrada salva.");
      setDirty(false);
    });

  const remove = () => {
    if (!selected) return;
    start(async () => {
      const res = await deleteJournalEntry(selected.id);
      if (!res.ok) toast.error(res.error);
      else toast.success("Entrada removida.");
    });
  };

  const mark = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold capitalize">{fmtDate(date, "EEEE, d 'de' MMMM")}</h2>
            <p className="text-xs text-muted-foreground">{selected ? "Editando entrada existente" : "Nova entrada"}{dirty ? " · alterações não salvas" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={date} max={today} onChange={(e) => e.target.value && go({ date: e.target.value })} className="w-40" aria-label="Data da entrada" />
            {selected ? <Button variant="ghost" size="icon" aria-label="Excluir entrada" onClick={remove} disabled={pending}><Trash2 /></Button> : null}
          </div>
        </div>
        <div className="space-y-2"><Label htmlFor="j-content">Como foi o dia?</Label><Textarea id="j-content" rows={6} value={content} onChange={(e) => mark(setContent)(e.target.value)} placeholder="Escreva livremente." /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Humor</Label>
            <ToggleGroup type="single" value={mood} onValueChange={mark(setMood)}>{MOOD.map((m, i) => <ToggleGroupItem key={m} value={String(i + 1)} aria-label={`Humor ${i + 1}`} className="text-lg">{m}</ToggleGroupItem>)}</ToggleGroup>
          </div>
          <div className="space-y-2">
            <Label>Energia</Label>
            <ToggleGroup type="single" value={energy} onValueChange={mark(setEnergy)}>{ENERGY.map((e, i) => <ToggleGroupItem key={e} value={String(i + 1)}>{e}</ToggleGroupItem>)}</ToggleGroup>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="j-good">Coisas boas que aconteceram</Label><Textarea id="j-good" rows={3} value={good} onChange={(e) => mark(setGood)(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="j-improve">O que poderia melhorar</Label><Textarea id="j-improve" rows={3} value={improve} onChange={(e) => mark(setImprove)(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="j-learn">Aprendizados</Label><Textarea id="j-learn" rows={3} value={learn} onChange={(e) => mark(setLearn)(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="j-tomorrow">Prioridades para amanhã</Label><Textarea id="j-tomorrow" rows={3} value={tomorrow} onChange={(e) => mark(setTomorrow)(e.target.value)} /></div>
        </div>
        <div className="flex justify-end"><Button onClick={save} loading={pending}><Save /> Salvar</Button></div>
      </section>

      <aside className="space-y-3">
        <form onSubmit={(e) => { e.preventDefault(); go({ q }); }} className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar no histórico" aria-label="Pesquisar" />
          <Button type="submit" variant="outline" size="icon" aria-label="Buscar"><Search /></Button>
        </form>
        {query ? <p className="text-xs text-muted-foreground">{entries.length} resultado{entries.length !== 1 ? "s" : ""} para “{query}” · <button type="button" className="underline" onClick={() => { setQ(""); go({ q: "" }); }}>limpar</button></p> : null}
        {entries.length === 0 ? <EmptyState icon={<BookOpen />} title={query ? "Nada encontrado" : "Nenhuma entrada ainda"} description={query ? "Tente outras palavras." : "Suas reflexões diárias ficam aqui."} /> : (
          <ul className="space-y-1.5">
            {entries.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => go({ date: e.date })} className={cn("w-full rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/50", e.date === date && "border-success/40")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{fmtDate(e.date, "EEE, d MMM")}</span>
                    <span className="flex gap-1">{e.mood ? <span>{MOOD[e.mood - 1]}</span> : null}{e.energy ? <Badge variant="muted">{ENERGY[e.energy - 1]}</Badge> : null}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{e.content || e.good_things || e.learnings || e.improve || "—"}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
