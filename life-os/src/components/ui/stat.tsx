import * as React from "react";
import { cn } from "@/lib/utils";

interface StatProps extends React.ComponentProps<"div"> {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "destructive" | "warning";
}

export function Stat({ label, value, hint, icon, tone = "default", className, ...props }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border border-border bg-card p-4", className)} {...props}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        {icon ? <span className="[&_svg]:size-4 text-muted-foreground/80">{icon}</span> : null}
      </div>
      <div
        className={cn(
          "text-2xl font-semibold tracking-tight tabular-nums",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </div>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
