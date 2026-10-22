import { BarChart3, BookOpen, CalendarDays, CheckSquare, Home, House, LayoutDashboard, ListChecks, Moon, Settings, Smartphone, Target, Timer, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/habitos", label: "Hábitos", icon: ListChecks },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/foco", label: "Foco", icon: Timer },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/tarefas", label: "Tarefas", icon: CheckSquare, description: "Pendências e prioridades" },
  { href: "/casa", label: "Casa", icon: House, description: "Faxina e tarefas domésticas" },
  { href: "/sono", label: "Sono", icon: Moon, description: "Horários e registros" },
  { href: "/bem-estar-digital", label: "Bem-estar digital", icon: Smartphone, description: "Tempo de tela" },
  { href: "/metas", label: "Metas", icon: Target, description: "Objetivos pessoais" },
  { href: "/estatisticas", label: "Estatísticas", icon: BarChart3, description: "Evolução e resumo semanal" },
  { href: "/diario", label: "Diário", icon: BookOpen, description: "Reflexões do dia" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, description: "Perfil, lembretes e dados" },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];
export { LayoutDashboard };
