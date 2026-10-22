"use client";

import { ResponsiveContainer } from "recharts";

/** Tokens de cor para gráficos (lidos das variáveis CSS do tema). */
export const CHART = {
  primary: "var(--chart-1)",
  muted: "var(--chart-2)",
  danger: "var(--chart-3)",
  info: "var(--chart-4)",
  warn: "var(--chart-5)",
  grid: "var(--border)",
  text: "var(--muted-foreground)",
};

export const tooltipStyle = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--foreground)" },
  labelStyle: { color: "var(--muted-foreground)" },
  itemStyle: { color: "var(--foreground)" },
  cursor: { fill: "var(--accent)", opacity: 0.4 },
};

export function ChartShell({ height = 220, children }: { height?: number; children: React.ReactElement }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
