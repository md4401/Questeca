import { describe, it, expect } from "vitest";
import { cycleStart, cycleEnd, canConsume, effectivePlan, effectiveLimits, PLANS } from "@/lib/core/plans";
import { can, canAccessClass } from "@/lib/core/permissions";

describe("planos e cotas", () => {
  it("limites do PRD", () => {
    expect(PLANS.free).toMatchObject({ assemblies: 3, classes: 1, cards: 40 });
    expect(PLANS.teacher).toMatchObject({ assemblies: 30, classes: 12, cards: 350, priceCents: 3990 });
  });
  it("ciclo mensal ancorado na data de início", () => {
    const start = cycleStart(new Date("2026-01-15T00:00:00Z"), new Date("2026-11-23T10:00:00Z"));
    expect(start.toISOString()).toBe("2026-11-15T00:00:00.000Z");
    expect(cycleEnd(start).toISOString()).toBe("2026-12-15T00:00:00.000Z");
    expect(cycleStart(new Date("2026-01-25T00:00:00Z"), new Date("2026-11-23T10:00:00Z")).toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });
  it("consumo", () => {
    expect(canConsume(2, 3)).toBe(true);
    expect(canConsume(3, 3)).toBe(false);
  });
  it("plano efetivo com atraso e cancelamento", () => {
    const now = new Date("2026-11-23T00:00:00Z");
    const base = { plan: "teacher" as const, periodEnd: new Date("2026-12-01T00:00:00Z") };
    expect(effectivePlan({ ...base, status: "active" }, now)).toBe("teacher");
    expect(effectivePlan({ ...base, status: "canceling" }, now)).toBe("teacher");
    expect(effectivePlan({ ...base, periodEnd: new Date("2026-11-01T00:00:00Z"), status: "canceling" }, now)).toBe("free");
    expect(effectivePlan({ ...base, status: "past_due", graceUntil: new Date("2026-11-25T00:00:00Z") }, now)).toBe("teacher");
    expect(effectivePlan({ ...base, status: "past_due", graceUntil: new Date("2026-11-20T00:00:00Z") }, now)).toBe("free");
    expect(effectivePlan({ ...base, status: "pending" }, now)).toBe("free");
  });
  it("contrato escolar sobrescreve limites", () => {
    expect(effectiveLimits("school", { assemblies: 500 }).assemblies).toBe(500);
  });
});

describe("SA-02 permissões", () => {
  const A = "org-a";
  it("professor só acessa turma atribuída da própria escola", () => {
    const m = { role: "teacher" as const, orgId: A, userId: "u1" };
    expect(canAccessClass(m, { orgId: A, teacherIds: ["u1"] })).toBe(true);
    expect(canAccessClass(m, { orgId: A, teacherIds: ["u2"] })).toBe(false);
    expect(canAccessClass(m, { orgId: "org-b", teacherIds: ["u1"] })).toBe(false);
    expect(canAccessClass(null, { orgId: A, teacherIds: ["u1"] })).toBe(false);
  });
  it("gestão não vê dados pedagógicos; coordenação vê da unidade", () => {
    expect(canAccessClass({ role: "admin", orgId: A, userId: "x" }, { orgId: A, teacherIds: [] })).toBe(false);
    expect(canAccessClass({ role: "coordinator", orgId: A, userId: "x" }, { orgId: A, teacherIds: [] })).toBe(true);
    expect(can("admin", "org.billing")).toBe(true);
    expect(can("coordinator", "org.billing")).toBe(false);
    expect(can("teacher", "org.invite")).toBe(false);
  });
});
