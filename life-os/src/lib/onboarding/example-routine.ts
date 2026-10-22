/** Rotina de exemplo oferecida no onboarding. Totalmente editável pelo usuário. */
export interface ExampleHabit {
  key: string;
  name: string;
  icon: string;
  period: "morning" | "afternoon" | "evening";
  time: string; // sugestão inicial, editável
  kind: "boolean" | "quantity" | "duration";
  target?: number;
  unit?: string;
  minutes?: number;
  color: string;
}

export const EXAMPLE_ROUTINE: ExampleHabit[] = [
  // Manhã
  { key: "wake", name: "Acordar no horário planejado", icon: "sunrise", period: "morning", time: "07:00", kind: "boolean", color: "#f59e0b" },
  { key: "bed", name: "Arrumar a cama", icon: "bed", period: "morning", time: "07:10", kind: "boolean", minutes: 2, color: "#22c55e" },
  { key: "hygiene", name: "Higiene pessoal", icon: "shower", period: "morning", time: "07:15", kind: "boolean", minutes: 20, color: "#38bdf8" },
  { key: "room10", name: "Organizar o quarto", icon: "broom", period: "morning", time: "07:40", kind: "duration", target: 10, minutes: 10, color: "#10b981" },
  { key: "priorities", name: "Conferir prioridades do dia", icon: "target", period: "morning", time: "08:00", kind: "boolean", minutes: 5, color: "#818cf8" },
  { key: "water", name: "Beber água", icon: "water", period: "morning", time: "08:30", kind: "quantity", target: 8, unit: "copos", color: "#38bdf8" },
  { key: "nosocial", name: "Não usar redes sociais ao acordar", icon: "phone", period: "morning", time: "07:00", kind: "boolean", color: "#a3a3a3" },
  // Tarde
  { key: "work", name: "Trabalhar nas prioridades", icon: "briefcase", period: "afternoon", time: "13:00", kind: "duration", target: 90, minutes: 90, color: "#818cf8" },
  { key: "walk", name: "Fazer uma caminhada", icon: "walk", period: "afternoon", time: "17:00", kind: "duration", target: 20, minutes: 20, color: "#22c55e" },
  { key: "pause", name: "Fazer uma pausa", icon: "coffee", period: "afternoon", time: "15:30", kind: "boolean", minutes: 10, color: "#f59e0b" },
  { key: "pending", name: "Organizar pendências", icon: "folder", period: "afternoon", time: "18:00", kind: "boolean", minutes: 15, color: "#a78bfa" },
  // Noite
  { key: "room_night", name: "Organizar o quarto (noite)", icon: "broom", period: "evening", time: "20:30", kind: "boolean", minutes: 5, color: "#10b981" },
  { key: "read", name: "Ler 10 páginas", icon: "book", period: "evening", time: "21:00", kind: "quantity", target: 10, unit: "páginas", minutes: 20, color: "#facc15" },
  { key: "social", name: "Reduzir o uso de redes sociais", icon: "phone", period: "evening", time: "21:30", kind: "boolean", color: "#a3a3a3" },
  { key: "prepare", name: "Preparar o próximo dia", icon: "calendar", period: "evening", time: "22:00", kind: "boolean", minutes: 10, color: "#38bdf8" },
  { key: "sleep", name: "Dormir no horário planejado", icon: "moon", period: "evening", time: "23:00", kind: "boolean", color: "#818cf8" },
];
