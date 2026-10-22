"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Minus, MoreHorizontal, Plus, SkipForward, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { clearCompletion, setCompletion, toggleCompletion } from "@/lib/actions/habits";
import type { HabitRow } from "@/lib/database.types";
import type { HabitDayStatus } from "@/lib/habits";

interface HabitCheckProps {
  habit: HabitRow;
  date: string;
  status: HabitDayStatus;
  value?: number | null;
  size?: "sm" | "md";
  showMenu?: boolean;
}

/** Botão de marcar/desmarcar o hábito no dia, com suporte a quantidade/duração e "pular com motivo". */
export function HabitCheck({ habit, date, status, value, size = "md", showMenu = true }: HabitCheckProps) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [quantityOpen, setQuantityOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [qty, setQty] = useState<string>(value != null ? String(value) : habit.target_value != null ? String(habit.target_value) : "");
  const [note, setNote] = useState("");

  const done = optimistic === "done";
  const skipped = optimistic === "skipped";

  const handleToggle = () => {
    if (habit.kind !== "boolean" && !done) {
      setQuantityOpen(true);
      return;
    }
    start(async () => {
      setOptimistic(done ? "pending" : "done");
      const res = await toggleCompletion(habit.id, date);
      if (!res.ok) toast.error(res.error);
    });
  };

  const saveQuantity = () => {
    const v = Number(qty);
    if (!Number.isFinite(v) || v < 0) return toast.error("Informe um valor válido.");
    setQuantityOpen(false);
    start(async () => {
      setOptimistic(habit.target_value == null || v >= habit.target_value ? "done" : "pending");
      const res = await setCompletion({ habitId: habit.id, date, status: "done", value: v });
      if (!res.ok) toast.error(res.error);
    });
  };

  const skip = () => {
    setSkipOpen(false);
    start(async () => {
      setOptimistic("skipped");
      const res = await setCompletion({ habitId: habit.id, date, status: "skipped", note });
      if (!res.ok) toast.error(res.error);
      else toast("Dia justificado. Sem culpa: a sequência continua.");
    });
  };

  const clear = () =>
    start(async () => {
      setOptimistic("pending");
      const res = await clearCompletion(habit.id, date);
      if (!res.ok) toast.error(res.error);
    });

  const btn = size === "sm" ? "size-8" : "size-10";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={done}
        aria-label={done ? `Desmarcar ${habit.name}` : `Concluir ${habit.name}`}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90",
          btn,
          done && "border-success bg-success text-success-foreground",
          skipped && "border-border bg-muted text-muted-foreground",
          !done && !skipped && "border-border text-transparent hover:border-success/60 hover:text-success/60",
        )}
      >
        {skipped ? <Minus className="size-4" /> : <Check className="size-5" strokeWidth={3} />}
      </button>
      {showMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Mais opções">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {habit.kind !== "boolean" ? (
              <DropdownMenuItem onSelect={() => setQuantityOpen(true)}>
                <Plus /> Registrar {habit.kind === "duration" ? "duração" : "quantidade"}
              </DropdownMenuItem>
            ) : null}
            {!skipped ? (
              <DropdownMenuItem onSelect={() => setSkipOpen(true)}>
                <SkipForward /> Pular hoje (com motivo)
              </DropdownMenuItem>
            ) : null}
            {done || skipped ? (
              <DropdownMenuItem onSelect={clear}>
                <X /> Remover registro
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <Dialog open={quantityOpen} onOpenChange={setQuantityOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{habit.name}</DialogTitle>
            <DialogDescription>
              {habit.target_value != null ? `Meta: ${habit.target_value} ${habit.unit ?? ""}` : "Quanto você fez?"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`qty-${habit.id}`}>{habit.kind === "duration" ? "Minutos" : `Quantidade${habit.unit ? ` (${habit.unit})` : ""}`}</Label>
            <Input id={`qty-${habit.id}`} type="number" inputMode="decimal" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && saveQuantity()} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQuantityOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveQuantity}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pular hoje</DialogTitle>
            <DialogDescription>Dias justificados não quebram a sequência nem contam contra você.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`note-${habit.id}`}>Motivo (opcional)</Label>
            <Textarea id={`note-${habit.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: viagem, doente, imprevisto" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSkipOpen(false)}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={skip}>
              Pular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
