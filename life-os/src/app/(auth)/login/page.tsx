import Link from "next/link";
import type { Metadata } from "next";
import { signIn } from "@/lib/auth/actions";
import { AuthForm } from "../auth-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
        <p className="text-sm text-muted-foreground">Entre para continuar sua rotina.</p>
      </div>
      {error === "link_invalido" ? <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">O link usado é inválido ou expirou. Tente novamente.</p> : null}
      <AuthForm action={signIn} submitLabel="Entrar" hidden={next ? { next } : undefined}>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="voce@exemplo.com" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link href="/recuperar-senha" className="text-xs text-muted-foreground hover:text-foreground">
              Esqueci a senha
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
        </div>
      </AuthForm>
      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-foreground underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
