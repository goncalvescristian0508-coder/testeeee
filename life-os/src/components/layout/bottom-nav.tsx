"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PRIMARY_NAV, SECONDARY_NAV } from "./nav-config";

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreActive = SECONDARY_NAV.some((i) => pathname.startsWith(i.href));

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl safe-bottom lg:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {PRIMARY_NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground")}
                >
                  <item.icon className={cn("size-5", active && "text-success")} strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              className={cn("flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors", moreActive ? "text-foreground" : "text-muted-foreground")}
            >
              <LayoutGrid className={cn("size-5", moreActive && "text-success")} />
              Mais
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="lg:hidden">
          <SheetHeader>
            <SheetTitle>Mais áreas</SheetTitle>
          </SheetHeader>
          <ul className="grid grid-cols-2 gap-2">
            {SECONDARY_NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn("flex flex-col gap-2 rounded-xl border border-border p-3 transition-colors hover:bg-accent", active && "border-success/40 bg-success/5")}
                  >
                    <item.icon className={cn("size-5", active ? "text-success" : "text-muted-foreground")} />
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
