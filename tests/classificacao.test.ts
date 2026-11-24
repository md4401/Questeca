import { describe, it, expect } from "vitest";
import { classificar } from "@/lib/core/classificacao";

describe("classificação de tema e série", () => {
  it("Machado de Assis → Realismo, 1ª/2ª série", () => {
    const c = classificar({ subject: "literatura", title: "Dom Casmurro: a dúvida central", statement: "No romance Dom Casmurro, de Machado de Assis, Bentinho...", alternatives: [] });
    expect(c.tema).toBe("Machado de Assis e Realismo");
    expect(c.series).toContain("em2");
  });
  it("interdisciplinar vira a disciplina do tema encontrado", () => {
    const c = classificar({ subject: "interdisciplinar", statement: "Uma função quadrática tem vértice e raízes. Qual o gráfico da função f(x)?", alternatives: [{ text: "parábola" }] });
    expect(c.subject).toBe("matematica");
    expect(c.tema).toBe("Funções");
  });
  it("respeita a disciplina informada", () => {
    expect(classificar({ subject: "historia", statement: "A Revolução Francesa e o Iluminismo marcaram...", alternatives: [] }).tema).toBe("Revoluções e Iluminismo");
  });
  it("sem pistas cai em Geral com ensino médio", () => {
    const c = classificar({ subject: "biologia", statement: "Considere a situação descrita.", alternatives: [] });
    expect(c.tema).toBe("Geral");
    expect(c.series).toEqual(["em1", "em2", "em3"]);
  });
});
