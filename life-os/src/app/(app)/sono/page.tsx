import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { SleepView } from "@/components/sleep/sleep-view";
import { getUserContext } from "@/lib/context";
import { loadSleepGoal, loadSleepLogs } from "@/lib/data/misc";
import { loadHabits } from "@/lib/data/habits";

export const metadata: Metadata = { title: "Sono" };

export default async function SonoPage() {
  const ctx = await getUserContext();
  const [goal, logs, habits] = await Promise.all([loadSleepGoal(ctx), loadSleepLogs(ctx, 90), loadHabits(ctx, { status: ["active"] })]);
  const aligned = habits
    .filter((h) => h.habit.period === "evening" || h.habit.period === "morning" || /dormir|acordar|sono|cama/i.test(h.habit.name))
    .map((h) => ({ name: h.habit.name, rate: h.monthRate }));
  return (
    <div className="space-y-6">
      <PageHeader title="Sono" description="Horários planejados, registros manuais e consistência." />
      <SleepView goal={goal} logs={logs} today={ctx.today} tz={ctx.tz} habitsAligned={aligned} />
    </div>
  );
}
