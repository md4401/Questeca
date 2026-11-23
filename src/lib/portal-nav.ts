import type { IconName } from "@/components/icons";
/** Navegação do portal (aluno e responsável). Cada fase acrescenta seus itens. */
export type PortalItem = { href: string; label: string; icon: IconName; roles?: ("student" | "guardian")[] };
export const PORTAL_NAV: PortalItem[] = [
  { href: "/portal", label: "Início", icon: "home" },
  { href: "/portal/tarefas", label: "Tarefas", icon: "tarefa" },
  { href: "/portal/agenda", label: "Agenda", icon: "agenda" },
  { href: "/portal/notas", label: "Notas", icon: "nota" },
  { href: "/portal/frequencia", label: "Frequência", icon: "chamada" },
  { href: "/portal/notificacoes", label: "Avisos", icon: "sino" },
];
