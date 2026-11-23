export type Role = "admin" | "coordinator" | "teacher";
export type Action =
  | "org.manage" | "org.invite" | "org.billing" | "org.templates" | "org.reports"
  | "class.create" | "class.view_all" | "doc.review" | "member.view";

const MATRIX: Record<Role, Action[]> = {
  admin: ["org.manage", "org.invite", "org.billing", "org.templates", "class.create", "class.view_all", "member.view"],
  // Gestão institucional não tem acesso pedagógico por padrão (PRD cap. 29).
  coordinator: ["org.templates", "org.reports", "doc.review", "class.view_all", "member.view", "class.create"],
  teacher: ["class.create"],
};

export function can(role: Role | null | undefined, action: Action) {
  return !!role && MATRIX[role]?.includes(action);
}

/** Professor só enxerga turmas atribuídas; coordenação enxerga as da unidade; gestão não vê dados pedagógicos. */
export function canAccessClass(
  m: { role: Role; orgId: string; userId: string } | null,
  cls: { orgId: string; teacherIds: string[] },
) {
  if (!m || m.orgId !== cls.orgId) return false;
  if (m.role === "coordinator") return true;
  if (m.role === "teacher") return cls.teacherIds.includes(m.userId);
  return false;
}

export const ROLE_LABEL: Record<Role, string> = { admin: "Gestão institucional", coordinator: "Coordenação", teacher: "Professor" };
