"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createCategory, deleteCategory, updateCategory } from "@/lib/actions/settings";
import type { CategoryRow } from "@/lib/database.types";
import { COLORS } from "@/lib/icons";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<CategoryRow["kind"], string> = { general: "Geral", habit: "Hábitos", event: "Agenda", task: "Tarefas", home: "Casa" };

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const [editing, setEditing] = useState<CategoryRow | "new" | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [kind, setKind] = useState<CategoryRow["kind"]>("general");
  const [pending, start] = useTransition();

  const open = (c: CategoryRow | "new") => {
    setEditing(c);
    setName(c === "new" ? "" : c.name);
    setColor(c === "new" ? COLORS[0] : c.color);
    setKind(c === "new" ? "general" : c.kind);
  };
  const save = () =>
    start(async () => {
      const res = editing === "new" ? await createCategory({ name, color, kind }) : await updateCategory((editing as CategoryRow).id, { name, color, kind });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Categoria salva.");
      setEditing(null);
    });
  const remove = (id: string) =>
    start(async () => {
      const res = await deleteCategory(id);
      if (!res.ok) toast.error(res.error);
    });

  return (
    <Card>
      <CardHeader><CardTitle>Categorias</CardTitle><CardDescription>Usadas em hábitos, tarefas e agenda. Excluir uma categoria não apaga os itens.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-border py-1 pl-2.5 pr-1 text-sm">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />{c.name}<span className="text-xs text-muted-foreground">· {KIND_LABEL[c.kind]}</span>
              <button type="button" aria-label={`Editar ${c.name}`} onClick={() => open(c)} className="rounded-full p-1 hover:bg-accent"><Pencil className="size-3" /></button>
              <button type="button" aria-label={`Excluir ${c.name}`} onClick={() => remove(c.id)} disabled={pending} className="rounded-full p-1 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-3" /></button>
            </span>
          ))}
          <Button size="sm" variant="outline" onClick={() => open("new")}><Plus /> Nova</Button>
        </div>
        {editing ? (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between"><p className="text-sm font-medium">{editing === "new" ? "Nova categoria" : "Editar categoria"}</p><button type="button" aria-label="Fechar" onClick={() => setEditing(null)}><X className="size-4" /></button></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
              <Select value={kind} onValueChange={(v) => setKind(v as CategoryRow["kind"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={cn("size-6 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")} style={{ backgroundColor: c }} />)}</div>
            <div className="flex justify-end"><Button size="sm" onClick={save} loading={pending}>Salvar</Button></div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
