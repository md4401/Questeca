import { describe, it, expect } from "vitest";
import { parseQuery, scoreDoc, norm, highlight } from "@/lib/core/search";

const D = (title: string, statement: string, extra = {}) => ({ title, statement, institution: "Questeca", exam: "Banco autoral", year: 2026, ...extra });
describe("Busca do banco", () => {
  it("normaliza acento e caixa", () => expect(norm("Guimarães Rosa!")).toBe("guimaraes rosa"));
  it("reconhece o autor mesmo sem acento e acha por citação", () => {
    const p = parseQuery("MACHADO de assis");
    expect(p.entities.map((e) => e.id)).toEqual(["machado"]);
    const m = scoreDoc(D("Capitu", "No romance, Bentinho suspeita de Escobar."), p);
    expect(m.score).toBeGreaterThan(0);
    expect(m.reasons.map((r) => r.text)).toContain("capitu".replace("capitu", "capitu")); // relacionada
  });
  it("acha por obra mesmo sem citar o autor, e rotula como relacionada", () => {
    const m = scoreDoc(D("Narrador", "Em Memórias Póstumas de Brás Cubas o narrador é um defunto-autor."), parseQuery("machado de assis"));
    expect(m.score).toBeGreaterThan(0);
    expect(m.reasons.some((r) => r.kind === "relacionada")).toBe(true);
  });
  it("citação direta vale mais que relacionada", () => {
    const p = parseQuery("machado de assis");
    expect(scoreDoc(D("Machado de Assis e o Realismo", "Texto."), p).score).toBeGreaterThan(scoreDoc(D("Capitu", "Texto sobre Capitu."), p).score);
  });
  it("não traz questão sem relação", () => expect(scoreDoc(D("Desconto", "Uma camisa de R$ 80 tem 25% de desconto."), parseQuery("machado de assis")).score).toBe(0));
  it("palavras livres exigem todos os termos", () => {
    expect(scoreDoc(D("Juros", "Juros compostos em 2 meses."), parseQuery("juros compostos")).score).toBeGreaterThan(0);
    expect(scoreDoc(D("Juros", "Juros simples."), parseQuery("juros compostos")).score).toBe(0);
  });
  it("destaca termos sem acento", () => {
    const h = highlight("O romance Dom Casmurro, de Machado.", ["dom casmurro", "machado"]);
    expect(h.filter((x) => x.hit).map((x) => x.t)).toEqual(["Dom Casmurro", "Machado"]);
  });
});
