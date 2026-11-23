import { describe, it, expect } from "vitest";
import { className, flatten, stepProblem, summarize, parseDraft, reconcile, type Draft } from "@/lib/core/onboarding";
import { normalize } from "@/lib/taxonomy";

const base: Draft = { step: 3, school: { kind: "none" }, subjects: ["matematica", "fisica"], assignments: { matematica: { "9": ["A", "B"] }, fisica: { em1: ["A"] } } };

describe("onboarding", () => {
  it("nomeia turmas", () => {
    expect(className("9", "b")).toBe("9º B");
    expect(className("em1", "A")).toBe("1ª A");
    expect(className("8", "Turma Alfa")).toBe("Turma Alfa");
    expect(className("8", "  ")).toBe("");
  });
  it("achata associações disciplina × série × turma sem duplicar", () => {
    expect(flatten(base).map((a) => `${a.subject}:${a.name}`)).toEqual(["matematica:9º A", "matematica:9º B", "fisica:1ª A"]);
    const dup = { ...base, assignments: { matematica: { "9": ["A", "a"] } }, subjects: ["matematica"] };
    expect(flatten(dup)).toHaveLength(1);
  });
  it("valida cada etapa", () => {
    expect(stepProblem({ ...base, school: undefined }, 1)).toMatch(/Escolha seu colégio/);
    expect(stepProblem({ ...base, school: { kind: "manual", name: "ab", city: "x", uf: "ZZ" } }, 1)).toMatch(/nome, cidade e UF/);
    expect(stepProblem({ ...base, subjects: [] }, 2)).toMatch(/ao menos uma disciplina/);
    expect(stepProblem({ ...base, assignments: { matematica: { "9": ["A"] } } }, 3)).toMatch(/cada disciplina/);
    expect(stepProblem(base, 3)).toBeNull();
  });
  it("remove associações órfãs ao trocar disciplinas", () => {
    expect(Object.keys(reconcile({ ...base, subjects: ["fisica"] }).assignments)).toEqual(["fisica"]);
  });
  it("resumo e leitura defensiva do rascunho salvo", () => {
    expect(summarize("Matemática", ["9º A", "9º B"])).toBe("Matemática · 9º A e 9º B");
    expect(summarize("Física", ["1ª A"])).toBe("Física · 1ª A");
    const d = parseDraft({ step: 9, subjects: ["x", 1], assignments: { x: { "9": ["A"], "99": ["B"] }, y: { "9": ["A"] } } });
    expect(d.step).toBe(1); expect(d.subjects).toEqual(["x"]); expect(d.assignments).toEqual({ x: { "9": ["A"] } });
  });
  it("normaliza busca sem acentos", () => { expect(normalize("Colégio São João")).toBe("colegio sao joao"); });
});
