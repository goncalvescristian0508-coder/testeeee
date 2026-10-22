import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { getProfile, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const profile = await getProfile();
  const name = profile?.display_name || user.email?.split("@")[0] || "Você";

  return (
    <div className="flex min-h-dvh w-full">
      <Sidebar name={name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-nav sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
