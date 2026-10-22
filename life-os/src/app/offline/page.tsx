import { WifiOff } from "lucide-react";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><WifiOff className="size-6" /></div>
      <h1 className="text-lg font-semibold">Você está offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">O Life OS precisa de conexão para carregar seus dados. Assim que a rede voltar, recarregue a página.</p>
    </main>
  );
}
