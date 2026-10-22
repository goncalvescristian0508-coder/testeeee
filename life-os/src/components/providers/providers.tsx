"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegistrar } from "@/components/providers/service-worker";
import { OnlineStatus } from "@/components/providers/online-status";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster />
        <ServiceWorkerRegistrar />
        <OnlineStatus />
      </TooltipProvider>
    </ThemeProvider>
  );
}
