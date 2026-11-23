import { describe, it, expect } from "vitest";
import { computeAverage, parseGradeInput, DEFAULT_RULES, applyRounding, type GradeCell, type GradeItemMeta } from "@/lib/core/grades";

const items: GradeItemMeta[] = [
  { id: "p", title: "Prova", weight: 60, maxPoints: 10, period: "1", recovery: false },
  { id: "t", title: "Trabalho", weight: 40, maxPoints: 10, period: "1", recovery: false },
];
const cell = (itemId: string, state: GradeCell["state"], value: number | null): GradeCell => ({ itemId, state, value });

describe("SA-05 média ponderada", () => {
  it("7,5 × 0,60 + 9,0 × 0,40 = 8,10 antes do arredondamento", () => {
    const r = computeAverage([cell("p", "value", 7.5), cell("t", "value", 9)], items, DEFAULT_RULES);
    expect(r.average).toBeCloseTo(8.1, 5);
    expect(r.formula).toContain("7,50 × 0,60 + 9,00 × 0,40 = 8,10");
    expect(r.partial).toBe(false);
  });
  it("arredondamentos", () => {
    expect(applyRounding(8.14, "tenth")).toBe(8.1);
    expect(applyRounding(8.1, "half")).toBe(8);
    expect(applyRounding(8.1, "up_half")).toBe(8.5);
  });
  it("média parcial quando falta lançamento", () => {
    const r = computeAverage([cell("p", "value", 7)], items, DEFAULT_RULES);
    expect(r.partial).toBe(true);
    expect(r.average).toBe(7);
    expect(r.ignored[0].why).toMatch(/pendente/);
  });
  it("zero registrado ≠ ausência ≠ não entregue ≠ pendente", () => {
    const zero = computeAverage([cell("p", "zero", 0), cell("t", "value", 10)], items, DEFAULT_RULES);
    expect(zero.average).toBeCloseTo(4, 5);
    const abs = computeAverage([cell("p", "absent", null), cell("t", "value", 10)], items, DEFAULT_RULES);
    expect(abs.average).toBe(10); // ausência não conta por padrão
    const absZero = computeAverage([cell("p", "absent", null), cell("t", "value", 10)], items, { ...DEFAULT_RULES, absenceCounts: "zero" });
    expect(absZero.average).toBeCloseTo(4, 5);
    const nd = computeAverage([cell("p", "not_delivered", null), cell("t", "value", 10)], items, DEFAULT_RULES);
    expect(nd.average).toBeCloseTo(4, 5); // falta de entrega conta zero por padrão
    const pend = computeAverage([cell("p", "pending", null), cell("t", "value", 10)], items, DEFAULT_RULES);
    expect(pend.average).toBe(10);
    expect(pend.partial).toBe(true);
  });
  it("campo vazio nunca vira zero", () => {
    const r = computeAverage([], items, DEFAULT_RULES);
    expect(r.average).toBeNull();
  });
  it("recuperação: maior nota e média, com antes/depois", () => {
    const it2 = [...items, { id: "r", title: "Recuperação", weight: 1, maxPoints: 10, period: "1", recovery: true }];
    const base = [cell("p", "value", 4), cell("t", "value", 4)];
    const a = computeAverage([...base, cell("r", "value", 7)], it2, { ...DEFAULT_RULES, recovery: "replace_if_higher" });
    expect(a.before).toBeCloseTo(4, 5); expect(a.average).toBe(7); expect(a.recoveryApplied).toBe(true);
    const b = computeAverage([...base, cell("r", "value", 8)], it2, { ...DEFAULT_RULES, recovery: "average" });
    expect(b.average).toBe(6);
    const c = computeAverage([...base, cell("r", "value", 8)], it2, { ...DEFAULT_RULES, recovery: "independent" });
    expect(c.average).toBeCloseTo(4, 5);
  });
  it("normaliza para a escala da escola", () => {
    const it3: GradeItemMeta[] = [{ id: "a", title: "A", weight: 1, maxPoints: 20, period: "1", recovery: false }];
    expect(computeAverage([cell("a", "value", 15)], it3, DEFAULT_RULES).average).toBe(7.5);
  });
});

describe("entrada de notas", () => {
  it("aceita vírgula decimal e estados", () => {
    expect(parseGradeInput("7,5", 10)).toEqual({ state: "value", value: 7.5 });
    expect(parseGradeInput("0", 10)).toEqual({ state: "zero", value: 0 });
    expect(parseGradeInput("F", 10)).toEqual({ state: "absent", value: null });
    expect(parseGradeInput("N", 10)).toEqual({ state: "not_delivered", value: null });
    expect(parseGradeInput("", 10)).toEqual({ state: "pending", value: null });
  });
  it("rejeita fora da faixa e inválidos", () => {
    expect(parseGradeInput("11", 10)).toHaveProperty("error");
    expect(parseGradeInput("abc", 10)).toHaveProperty("error");
    expect(parseGradeInput("-1", 10)).toHaveProperty("error");
  });
});
