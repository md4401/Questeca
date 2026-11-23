export type Role = "admin" | "coordinator" | "teacher" | "student" | "guardian";
export const isPortalRole = (r: Role | null | undefined) => r === "student" || r === "guardian";
export type Action =
  | "org.manage" | "org.invite" | "org.billing" | "org.templates" | "org.reports"
  | "class.create" | "class.view_all" | "doc.review" | "member.view";

const MATRIX: Record<Role, Action[]> = {
  admin: ["org.manage", "org.invite", "org.billing", "org.templates", "class.create", "class.view_all", "member.view"],
  // Gestão institucional não tem acesso pedagógico por padrão (PRD cap. 29).
  coordinator: ["org.templates", "org.reports", "doc.review", "class.view_all", "member.view", "class.create"],
  teacher: ["class.create"],
  // Aluno e responsável só usam o portal: nenhuma ação de gestão.
  student: [],
  guardian: [],
};

export function can(role: Role | null | undefined, action: Action) {
  return !!role && MATRIX[role]?.includes(action);
}

/** Professor só enxerga turmas atribuídas; coordenação enxerga as da unidade; gestão só com atribuição explícita. */
export function canAccessClass(
  m: { role: Role; orgId: string; userId: string } | null,
  cls: { orgId: string; teacherIds: string[] },
) {
  if (!m || m.orgId !== cls.orgId || isPortalRole(m.role)) return false;
  if (m.role === "coordinator") return true;
  // Professor e gestão só acessam turmas atribuídas a eles (gestão: permissão pedagógica própria).
  return cls.teacherIds.includes(m.userId);
}

export const ROLE_LABEL: Record<Role, string> = { admin: "Gestão institucional", coordinator: "Coordenação", teacher: "Professor", student: "Aluno", guardian: "Responsável" };
