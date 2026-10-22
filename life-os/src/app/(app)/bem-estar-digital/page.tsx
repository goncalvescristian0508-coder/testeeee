import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ScreenTimeView } from "@/components/digital/screen-time-view";
import { getUserContext } from "@/lib/context";
import { loadFocusSessions, loadScreenTimeGoals, loadScreenTimeLogs } from "@/lib/data/misc";
import { focusTotals } from "@/lib/focus";

export const metadata: Metadata = { title: "Bem-estar digital" };

export default async function BemEstarDigitalPage() {
  const ctx = await getUserContext();
  const [logs, goals, sessions] = await Promise.all([loadScreenTimeLogs(ctx, 90), loadScreenTimeGoals(ctx), loadFocusSessions(ctx, 8)]);
  const totals = focusTotals(sessions, ctx.tz, ctx.today, ctx.weekStartsOn);
  return (
    <div className="space-y-6">
      <PageHeader title="Bem-estar digital" description="Tempo de tela informado, metas e progresso de redução." />
      <ScreenTimeView logs={logs} goals={goals} today={ctx.today} socialFreeMinutes7d={totals.socialFreeMinutes} />
    </div>
  );
}
