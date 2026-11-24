import { describe, it, expect } from "vitest";
import { creditsOf, estimateTokens, fmtCredits, TOKENS_POR_CREDITO } from "@/lib/core/credits";

describe("créditos de IA", () => {
  it("1.000 tokens = 1 crédito", () => {
    expect(TOKENS_POR_CREDITO).toBe(1000);
    expect(creditsOf(1000)).toBe(1);
    expect(creditsOf(5400)).toBeCloseTo(5.4);
    expect(fmtCredits(5.43)).toBe("5,4");
  });
  it("estima tokens por caracteres quando o provedor não informa", () => {
    expect(estimateTokens(3300)).toBe(1000);
    expect(estimateTokens(0)).toBe(0);
  });
  it("uma prova pela GizIA com entrevista (≈ 12 mil tokens) cabe 10 vezes em 200 créditos", () => {
    const porProva = creditsOf(12_000);
    expect(porProva * 10).toBeLessThanOrEqual(200);
  });
});
