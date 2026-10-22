import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { FocusView } from "@/components/focus/focus-view";
import { getUserContext } from "@/lib/context";
import { loadFocusSessions } from "@/lib/data/misc";

export const metadata: Metadata = { title: "Foco" };

export default async function FocoPage() {
  const ctx = await getUserContext();
  const [sessions, { data: habits }] = await Promise.all([loadFocusSessions(ctx, 60), ctx.supabase.from("habits").select("*").eq("user_id", ctx.user.id).eq("status", "active").order("sort_order")]);
  return (
    <div className="space-y-6">
      <PageHeader title="Foco" description="Sessões de concentração e controle de distrações." />
      <FocusView sessions={sessions} habits={habits ?? []} today={ctx.today} tz={ctx.tz} weekStartsOn={ctx.weekStartsOn} />
    </div>
  );
}
