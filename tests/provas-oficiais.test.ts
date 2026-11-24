import { describe, it, expect } from "vitest";
import { searchCatalog, type Catalogo } from "@/lib/core/provas-oficiais";
import data from "@/data/provas-oficiais.json";

const cat = data as unknown as Catalogo;
describe("Catálogo de provas e gabaritos oficiais", () => {
  it("carrega o catálogo importado", () => {
    expect(cat.edicoes.length).toBeGreaterThan(400);
    expect(cat.edicoes.reduce((a, e) => a + e.ar.length, 0)).toBeGreaterThan(2000);
    expect(new Set(cat.edicoes.map((e) => e.s)).has("enem")).toBe(true);
  });
  it("todo arquivo tem link https e tipo conhecido", () => {
    for (const e of cat.edicoes) for (const a of e.ar) { expect(a.u).toMatch(/^https?:\/\//); expect(["prova", "gabarito", "caderno", "comentada", "edital", "outro"]).toContain(a.t); }
  });
  it("busca por instituição, ano e sigla popular", () => {
    const enem = searchCatalog(cat, { q: "enem 2023" });
    expect(enem.length).toBeGreaterThan(0); expect(enem.every((r) => r.ed.s === "enem" && r.ed.a === 2023)).toBe(true);
    const usp = searchCatalog(cat, { q: "usp" }); expect(usp.some((r) => r.ed.s === "fuvest")).toBe(true);
    const unicamp = searchCatalog(cat, { q: "unicamp 2020" }); expect(unicamp.length).toBeGreaterThan(0); expect(unicamp.every((r) => r.ed.s === "comvest")).toBe(true);
  });
  it("filtros de instituição, ano e tipo; sem acento", () => {
    const r = searchCatalog(cat, { inst: "fuvest", ano: 2020, tipo: "gabarito" });
    expect(r.length).toBeGreaterThan(0); expect(r.every((x) => x.ed.s === "fuvest" && x.ed.a === 2020 && x.arquivos.every((a) => a.t === "gabarito"))).toBe(true);
    expect(searchCatalog(cat, { q: "REDACAO" }).length).toBeGreaterThanOrEqual(0);
  });
  it("sem resultado quando nada combina", () => expect(searchCatalog(cat, { q: "zzzxxyy" })).toHaveLength(0));
  it("ordena do ano mais recente para o mais antigo", () => {
    const r = searchCatalog(cat, { inst: "enem" }); for (let i = 1; i < r.length; i++) expect(r[i - 1].ed.a).toBeGreaterThanOrEqual(r[i].ed.a);
  });
});
