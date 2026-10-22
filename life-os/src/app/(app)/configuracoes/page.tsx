import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { NotificationPrefs } from "@/components/settings/notification-prefs";
import { CategoriesManager } from "@/components/settings/categories-manager";
import { DataSection } from "@/components/settings/data-section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserContext } from "@/lib/context";
import { loadCategories } from "@/lib/data/categories";
import { loadNotificationPreferences } from "@/lib/data/misc";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const ctx = await getUserContext();
  const [categories, prefs, { data: habits }] = await Promise.all([loadCategories(ctx), loadNotificationPreferences(ctx), ctx.supabase.from("habits").select("*").eq("user_id", ctx.user.id).eq("status", "active").order("sort_order")]);
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Perfil, horários, lembretes, categorias e dados." />
      <ProfileForm profile={ctx.profile} habits={habits ?? []} />
      <NotificationPrefs prefs={prefs} />
      <CategoriesManager categories={categories} />
      <Card>
        <CardHeader><CardTitle>Instalar como app</CardTitle><CardDescription>O Life OS funciona como PWA, em tela cheia e com ícone próprio.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3"><p className="font-medium">iPhone / iPad</p><p className="text-muted-foreground">Abra no Safari › botão Compartilhar › “Adicionar à Tela de Início”.</p></div>
          <div className="rounded-lg border border-border p-3"><p className="font-medium">Computador (Chrome/Edge)</p><p className="text-muted-foreground">Clique no ícone de instalação na barra de endereço ou em Menu › “Instalar Life OS”.</p></div>
        </CardContent>
      </Card>
      <DataSection email={ctx.user.email ?? ""} />
    </div>
  );
}
