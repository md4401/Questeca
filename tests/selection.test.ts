import { describe, it, expect } from "vitest";
import { evaluate, selectQuestions, scopeConflicts, type Candidate } from "@/lib/core/selection";
import type { Scope } from "@/db/schema";

const q = (o: Partial<Candidate> & { id: string }): Candidate => ({
  status: "released", voided: false, answer: "E", statement: "x", assessed: [], prerequisites: [], methods: [],
  difficulty: 3, estSeconds: 180, institution: "Segunda Lousa", year: 2013, ...o,
});
const scope = (o: Partial<Scope>): Scope => ({ willFall: [], prerequisite: [], notTaught: [], confirm: [], ...o });

describe("AV-01 filtro de pré-requisitos", () => {
  const ref = q({ id: "ref", assessed: ["porcentagem-simples", "descontos-sucessivos"] });
  it("aceita quando descontos sucessivos vai cair", () => {
    const v = evaluate(ref, scope({ willFall: ["porcentagem-simples", "descontos-sucessivos"], notTaught: ["juros-compostos"] }));
    expect(v.ok).toBe(true);
  });
  it("rejeita quando descontos sucessivos vira 'ainda não ensinei', mesmo com porcentagem", () => {
    const v = evaluate(ref, scope({ willFall: ["porcentagem-simples"], notTaught: ["descontos-sucessivos"] }));
    expect(v).toMatchObject({ ok: false, code: "excluded" });
  });
  it("rejeita item de 'porcentagem' que exige juros compostos excluído", () => {
    const v = evaluate(q({ id: "j", assessed: ["porcentagem-simples"], prerequisites: ["juros-compostos"] }), scope({ willFall: ["porcentagem-simples"], notTaught: ["juros-compostos"] }));
    expect(v).toMatchObject({ ok: false, code: "excluded" });
  });
  it("aceita se existe método alternativo válido dentro do escopo", () => {
    const v = evaluate(q({ id: "alt", assessed: ["porcentagem-simples"], prerequisites: ["juros-compostos"], methods: ["porcentagem-simples"] }), scope({ willFall: ["porcentagem-simples"], notTaught: ["juros-compostos"] }));
    expect(v.ok).toBe(true);
  });
  it("tópico 'preciso confirmar' manda para revisão", () => {
    const v = evaluate(q({ id: "c", assessed: ["fracoes"] }), scope({ willFall: ["fracoes"], confirm: ["fracoes"] }));
    expect(v).toMatchObject({ ok: false, code: "needs_confirmation" });
  });
  it("exige conhecimento dentro do conjunto confirmado", () => {
    const v = evaluate(q({ id: "o", assessed: ["fracoes"], prerequisites: ["potenciacao"] }), scope({ willFall: ["fracoes"] }));
    expect(v).toMatchObject({ ok: false, code: "out_of_scope" });
    const w = evaluate(q({ id: "o2", assessed: ["fracoes"], prerequisites: ["potenciacao"] }), scope({ willFall: ["fracoes"], prerequisite: ["potenciacao"] }));
    expect(w.ok).toBe(true);
  });
});

describe("integridade", () => {
  const s = scope({ willFall: ["fracoes"] });
  it.each([
    ["não liberada", { status: "curation" as const }],
    ["só referência", { status: "reference_only" as const }],
    ["bloqueada", { status: "blocked" as const }],
    ["em revisão", { status: "in_review" as const }],
    ["anulada", { voided: true }],
    ["sem gabarito", { answer: null }],
    ["sem enunciado", { statement: null }],
  ])("remove item %s", (_n, o) => {
    expect(evaluate(q({ id: "i", assessed: ["fracoes"], ...o }), s)).toMatchObject({ ok: false, code: "integrity" });
  });
});

describe("AV-02 cobertura insuficiente", () => {
  it("devolve 6 de 8 com temas descobertos", () => {
    const pool = Array.from({ length: 6 }, (_, i) => q({ id: `p${i}`, assessed: ["porcentagem-simples"] }));
    pool.push(q({ id: "fora", assessed: ["porcentagem-simples"], prerequisites: ["juros-compostos"] }));
    const r = selectQuestions(pool, scope({ willFall: ["porcentagem-simples", "descontos-sucessivos"], notTaught: ["juros-compostos"] }), { wanted: 8, durationMin: 60 });
    expect(r.found).toBe(6);
    expect(r.shortfall).toBe(true);
    expect(r.uncovered).toEqual(["descontos-sucessivos"]);
    expect(r.picks.map((p) => p.id)).not.toContain("fora");
    expect(r.rejected.find((x) => x.id === "fora")?.code).toBe("excluded");
  });
  it("prioriza lacunas de cobertura", () => {
    const pool = [q({ id: "a", assessed: ["fracoes"] }), q({ id: "b", assessed: ["fracoes"] }), q({ id: "c", assessed: ["decimais"] })];
    const r = selectQuestions(pool, scope({ willFall: ["fracoes", "decimais"] }), { wanted: 2, durationMin: 60 });
    expect(new Set(r.picks.map((p) => p.id))).toEqual(new Set(["c", expect.stringMatching(/a|b/)]));
  });
  it("agrupa itens com estímulo comum", () => {
    const pool = [q({ id: "s1", assessed: ["fracoes"], stimulusId: "T" }), q({ id: "x", assessed: ["fracoes"] }), q({ id: "s2", assessed: ["fracoes"], stimulusId: "T" })];
    const r = selectQuestions(pool, scope({ willFall: ["fracoes"] }), { wanted: 3, durationMin: 60 });
    const ids = r.picks.map((p) => p.id);
    expect(Math.abs(ids.indexOf("s1") - ids.indexOf("s2"))).toBe(1);
  });
  it("respeita filtros de instituição e ano", () => {
    const pool = [q({ id: "e", assessed: ["fracoes"], institution: "Inep", year: 2013 }), q({ id: "f", assessed: ["fracoes"], institution: "Fuvest", year: 2020 })];
    const r = selectQuestions(pool, scope({ willFall: ["fracoes"] }), { wanted: 2, durationMin: 60, filters: { institutions: ["Inep"], yearTo: 2015 } });
    expect(r.picks.map((p) => p.id)).toEqual(["e"]);
  });
  it("não repete questões e não trava sem candidatos", () => {
    expect(selectQuestions([], scope({ willFall: ["fracoes"] }), { wanted: 3, durationMin: 50 }).found).toBe(0);
  });
});

describe("AV-04 conflito de escopo", () => {
  it("sinaliza item fixado que exige conteúdo agora excluído", () => {
    const item = { id: "it", pinned: true, q: q({ id: "z", assessed: ["porcentagem-simples"], prerequisites: ["juros-compostos"] }) };
    expect(scopeConflicts([item], scope({ willFall: ["porcentagem-simples"], notTaught: ["juros-compostos"] }))).toHaveLength(1);
    expect(scopeConflicts([item], scope({ willFall: ["porcentagem-simples"], prerequisite: ["juros-compostos"] }))).toHaveLength(0);
  });
});
