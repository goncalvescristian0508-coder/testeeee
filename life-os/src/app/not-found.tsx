import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-semibold tracking-tight text-muted-foreground">404</p>
      <p className="text-sm text-muted-foreground">Esta página não existe.</p>
      <Button asChild variant="outline">
        <Link href="/dashboard">Voltar ao início</Link>
      </Button>
    </main>
  );
}
