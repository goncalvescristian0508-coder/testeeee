import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getUserContext } from "@/lib/context";

export const metadata: Metadata = { title: "Boas-vindas" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getUserContext();
  if (ctx.profile.onboarding_completed) redirect("/dashboard");
  return (
    <main className="min-h-dvh px-4 py-8 safe-top safe-bottom sm:py-14">
      <OnboardingWizard initialName={ctx.profile.display_name ?? ""} />
    </main>
  );
}
