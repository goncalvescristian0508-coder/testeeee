"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, LogOut, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { deleteAccount, deleteAllData } from "@/lib/actions/settings";
import { signOut } from "@/lib/auth/actions";

export function DataSection({ email }: { email: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [confirmData, setConfirmData] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();

  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const json = JSON.parse(await file.text());
      const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(json) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Falha na importação.");
      const total = Object.values(j.counts as Record<string, number>).reduce((a, b) => a + b, 0);
      if (j.errors?.length) toast.warning(`Importação parcial: ${total} registros. ${j.errors.join(" · ")}`);
      else toast.success(`Importação concluída: ${total} registros.`);
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Arquivo inválido.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const wipe = () =>
    start(async () => {
      const res = await deleteAllData(typed);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Todos os dados foram apagados.");
      setConfirmData(false);
      setTyped("");
      router.push("/onboarding");
      router.refresh();
    });

  const removeAccount = () =>
    start(async () => {
      const res = await deleteAccount(typed);
      if (res && !res.ok) toast.error(res.error);
    });

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Dados</CardTitle><CardDescription>Exporte um backup completo em JSON ou restaure a partir dele. A importação não duplica registros.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><a href="/api/export" download><Download /> Exportar dados</a></Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} loading={importing}><Upload /> Importar dados</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <Button variant="ghost" className="text-destructive" onClick={() => { setTyped(""); setConfirmData(true); }}><Trash2 /> Apagar todos os dados</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Conta e privacidade</CardTitle><CardDescription>Conectado como {email}. Seus dados são protegidos por políticas de acesso por usuário (RLS) e só você pode lê-los.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={signOut}><Button type="submit" variant="outline"><LogOut /> Sair</Button></form>
          <Button variant="ghost" className="text-destructive" onClick={() => { setTyped(""); setConfirmAccount(true); }}><Trash2 /> Excluir conta</Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmData} onOpenChange={setConfirmData}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Apagar todos os dados?</AlertDialogTitle><AlertDialogDescription>Hábitos, tarefas, agenda, sono, foco, metas e diário serão removidos permanentemente. A conta é mantida. Exporte antes, se quiser guardar.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-2"><Label htmlFor="c-data">Digite <span className="font-mono">APAGAR</span> para confirmar</Label><Input id="c-data" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></div>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.preventDefault(); wipe(); }} disabled={typed !== "APAGAR" || pending}>Apagar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmAccount} onOpenChange={setConfirmAccount}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir a conta?</AlertDialogTitle><AlertDialogDescription>A conta e todos os dados serão apagados de forma irreversível.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-2"><Label htmlFor="c-acc">Digite <span className="font-mono">EXCLUIR CONTA</span> para confirmar</Label><Input id="c-acc" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></div>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(e) => { e.preventDefault(); removeAccount(); }} disabled={typed !== "EXCLUIR CONTA" || pending}>Excluir conta</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
