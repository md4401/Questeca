import { describe, expect, it } from "vitest";
import { gerarCodigo, lerPerguntas, normalizarCodigo, pontosDaResposta, perguntasParaTexto, ranking } from "@/lib/core/quiz";

describe("quiz ao vivo", () => {
  it("pontua mais quem responde mais rápido e zera erros", () => {
    expect(pontosDaResposta(true, 0, 20)).toBe(1000);
    expect(pontosDaResposta(true, 10000, 20)).toBe(750);
    expect(pontosDaResposta(true, 20000, 20)).toBe(500);
    expect(pontosDaResposta(false, 1000, 20)).toBe(0);
    expect(pontosDaResposta(true, 40000, 20)).toBe(0);
  });
  it("gera código de 6 caracteres sem ambíguos e normaliza o digitado", () => {
    const c = gerarCodigo(); expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(normalizarCodigo(" ab-c 123xyz ")).toBe("ABC123");
  });
  it("lê perguntas e valida", () => {
    const r = lerPerguntas("Quanto é 2+2? [30s]\n* 4\n- 3\n- 5\n\nCapital do Brasil?\n- SP\n* Brasília");
    expect(r.erros).toEqual([]);
    expect(r.perguntas).toHaveLength(2);
    expect(r.perguntas[0]).toMatchObject({ certa: 0, segundos: 30 });
    expect(r.perguntas[1]).toMatchObject({ certa: 1, segundos: 20 });
    expect(lerPerguntas(perguntasParaTexto(r.perguntas)).perguntas).toEqual(r.perguntas);
    expect(lerPerguntas("Sem opções").erros[0]).toMatch(/2 a 4/);
    expect(lerPerguntas("X?\n- a\n- b").erros[0]).toMatch(/certa/);
    expect(lerPerguntas("X?\n* a\n* b").erros[0]).toMatch(/mais de uma/);
  });
  it("ranking desempata pelo apelido", () => {
    const r = ranking([{ id: "1", nickname: "Bia", score: 10 }, { id: "2", nickname: "Ana", score: 10 }, { id: "3", nickname: "Caio", score: 20 }]);
    expect(r.map((x) => x.nickname)).toEqual(["Caio", "Ana", "Bia"]);
  });
});
