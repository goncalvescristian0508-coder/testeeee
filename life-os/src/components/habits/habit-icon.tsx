import { createElement } from "react";
import { iconFor } from "@/lib/icons";

/** Renderiza o ícone de um hábito pelo nome, sem criar componentes durante o render. */
export function HabitIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  return createElement(iconFor(name), { className });
}
