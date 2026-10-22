import Link from "next/link";
import type { Metadata } from "next";
import { signUp } from "@/lib/auth/actions";
import { AuthForm } from "../auth-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Criar conta" };

export default function CadastroPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Criar sua conta</h1>
        <p className="text-sm text-muted-foreground">Seus dados ficam privados e só você tem acesso.</p>
      </div>
      <AuthForm action={signUp} submitLabel="Criar conta">
        <div className="space-y-2">
          <Label htmlFor="name">Como quer ser chamado?</Label>
          <Input id="name" name="name" autoComplete="given-name" required placeholder="Seu nome" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required placeholder="voce@exemplo.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="Mínimo de 8 caracteres" />
        </div>
      </AuthForm>
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
