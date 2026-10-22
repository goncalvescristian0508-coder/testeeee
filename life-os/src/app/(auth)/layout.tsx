import Link from "next/link";
import { Sprout } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 safe-top safe-bottom">
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-success/15 text-success">
          <Sprout className="size-5" />
        </span>
        <span className="text-xl font-semibold tracking-tight">Life OS</span>
      </Link>
      <div className="w-full max-w-sm animate-slide-up">{children}</div>
      <p className="mt-10 max-w-xs text-center text-xs text-muted-foreground">Rotina organizada, mensurável e sustentável. Sem distrações.</p>
    </main>
  );
}
