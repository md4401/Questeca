import { describe, expect, it } from "vitest";
import { problemasDaQuestao, impressaoDigital } from "@/lib/core/qualidade";

const alts = (...t: string[]) => t.map((text, i) => ({ key: "ABCDE"[i], text }));
describe("qualidade das questões", () => {
  it("questão boa não tem problema", () => expect(problemasDaQuestao({ statement: "Qual é a capital do Brasil, país da América do Sul?", alternatives: alts("Rio", "Brasília", "São Paulo", "Salvador"), answer: "B" })).toEqual([]));
  it("pega cabeçalho de página e glifo quebrado", () => {
    const p = problemasDaQuestao({ statement: "A incorporação… ##### Concurso Vestibular FUVEST 2025 – Prova V1 { 87} Tecidos", alternatives: alts("a", "b", "c", "d"), answer: "A" });
    expect(p).toContain("cabecalho-de-pagina");
    expect(problemasDaQuestao({ statement: "Considere a matriz A = � 1 k 3 � e calcule o determinante.", alternatives: alts("1", "2"), answer: "A" })).toContain("glifo-quebrado");
  });
  it("gabarito inválido, alternativas repetidas e vazias", () => {
    const p = problemasDaQuestao({ statement: "Enunciado suficientemente longo para passar.", alternatives: alts("igual", "igual", ""), answer: "E" });
    expect(p).toEqual(expect.arrayContaining(["gabarito-invalido", "alternativas-duplicadas", "alternativa-vazia"]));
  });
  it("questões do professor/IA podem ser curtas; as extraídas não", () => {
    expect(problemasDaQuestao({ statement: "2/3 + 3/4 é:", alternatives: alts("a", "b"), answer: "A", origin: "ia" })).toEqual([]);
    expect(problemasDaQuestao({ statement: "2/3 + 3/4 é:", alternatives: alts("a", "b"), answer: "A", origin: "banco" })).toContain("enunciado-curto");
  });
  it("impressão digital ignora acento e caixa", () => {
    expect(impressaoDigital({ statement: "Qual é a Média?", alternatives: alts("Um", "Dois") })).toBe(impressaoDigital({ statement: "qual e a media", alternatives: alts("um", "dois") }));
  });
});
