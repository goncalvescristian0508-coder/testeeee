"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, SECONDARY_NAV } from "./nav-config";

export function Sidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const render = (items: typeof PRIMARY_NAV) =>
    items.map((item) => {
      const active = pathname === item.href || pathname.startsWith(item.href + "/");
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          <item.icon className={cn("size-4 shrink-0", active ? "text-success" : "text-muted-foreground group-hover:text-foreground")} />
          {item.label}
        </Link>
      );
    });

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
        <span className="flex size-8 items-center justify-center rounded-lg bg-success/15 text-success">
          <Sprout className="size-4" />
        </span>
        <span className="font-semibold tracking-tight">Life OS</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 scrollbar-thin" aria-label="Principal">
        {render(PRIMARY_NAV)}
        <div className="my-2 h-px bg-border" />
        {render(SECONDARY_NAV)}
      </nav>
      <div className="border-t border-border px-5 py-4">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">Um dia de cada vez.</p>
      </div>
    </aside>
  );
}
