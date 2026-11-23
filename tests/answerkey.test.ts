import { describe, it, expect } from "vitest";
import { parseAnswerKey, scoreResponse, normalizeResponse } from "@/lib/core/answerkey";

describe("gabarito externo e correção", () => {
  it("objetivas dividem o total", () => {
    const r = parseAnswerKey("A,c,B,E", 10);
    expect(r).toMatchObject({ key: ["A", "C", "B", "E"], points: [2.5, 2.5, 2.5, 2.5] });
  });
  it("discursiva com critérios explícitos (1 ponto conclusão + 2 justificativa)", () => {
    const r = parseAnswerKey("A,D(Conclusão=1;Justificativa=2),B", 10);
    if ("error" in r) throw new Error(r.error);
    expect(r.key).toEqual(["A", "*", "B"]);
    expect(r.points).toEqual([3.5, 3, 3.5]);
    expect(r.rubrics[1].map((c) => c.points)).toEqual([1, 2]);
  });
  it("rejeita entradas inválidas", () => {
    expect(parseAnswerKey("A,Z", 10)).toHaveProperty("error");
    expect(parseAnswerKey("", 10)).toHaveProperty("error");
    expect(parseAnswerKey("D(Sem pontos)", 10)).toHaveProperty("error");
    expect(parseAnswerKey("D(A=20)", 10)).toHaveProperty("error");
  });
  it("pontua acerto, erro, branco e pendente", () => {
    expect(scoreResponse({ key: "C", points: 2, value: "C", status: "answered" })).toEqual({ points: 2, status: "answered" });
    expect(scoreResponse({ key: "C", points: 2, value: "B", status: "answered" })).toEqual({ points: 0, status: "answered" });
    expect(scoreResponse({ key: "C", points: 2, value: "-", status: "answered" })).toEqual({ points: 0, status: "blank" });
    expect(scoreResponse({ key: "C", points: 2, value: null, status: "pending" })).toEqual({ points: null, status: "pending" });
    expect(scoreResponse({ key: "*", points: 3, value: "2,5", status: "answered" }).points).toBe(2.5);
    expect(scoreResponse({ key: "*", points: 3, value: "9", status: "answered" }).points).toBe(3);
  });
  it("alternativa D é objetiva e não se confunde com discursiva", () => {
    expect(scoreResponse({ key: "D", points: 2, value: "D", status: "answered" })).toEqual({ points: 2, status: "answered" });
    expect(scoreResponse({ key: "D", points: 2, value: "C", status: "answered" })).toEqual({ points: 0, status: "answered" });
    expect(normalizeResponse("d", "D").value).toBe("D");
    const r = parseAnswerKey("D,D,A", 9);
    if ("error" in r) throw new Error(r.error);
    expect(r.points).toEqual([3, 3, 3]);
  });
  it("normaliza entrada", () => {
    expect(normalizeResponse("b", "A").value).toBe("B");
    expect(normalizeResponse("", "A").value).toBe("-");
    expect(normalizeResponse("Z", "A").error).toBeTruthy();
    expect(normalizeResponse("2,5", "*").value).toBe("2.5");
  });
});
