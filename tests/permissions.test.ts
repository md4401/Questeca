import { describe, it, expect } from "vitest";
import { can, canAccessClass, isPortalRole } from "@/lib/core/permissions";

describe("permissões de papéis", () => {
  it("aluno e responsável não têm nenhuma ação de gestão", () => {
    for (const r of ["student", "guardian"] as const) {
      expect(isPortalRole(r)).toBe(true);
      for (const a of ["org.manage", "org.invite", "org.billing", "org.templates", "org.reports", "class.create", "class.view_all", "doc.review", "member.view"] as const) expect(can(r, a)).toBe(false);
    }
    expect(isPortalRole("teacher")).toBe(false);
  });
  it("aluno e responsável nunca acessam turma pela regra de equipe, nem se constarem como atribuídos", () => {
    const cls = { orgId: "o1", teacherIds: ["u1", "u2"] };
    expect(canAccessClass({ role: "teacher", orgId: "o1", userId: "u1" }, cls)).toBe(true);
    expect(canAccessClass({ role: "student", orgId: "o1", userId: "u2" }, cls)).toBe(false);
    expect(canAccessClass({ role: "guardian", orgId: "o1", userId: "u2" }, cls)).toBe(false);
    expect(canAccessClass({ role: "teacher", orgId: "o2", userId: "u1" }, cls)).toBe(false);
  });
});
