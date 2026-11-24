import { describe, expect, it } from "vitest";
import { embaralhar, grupos, gruposPorTamanho } from "@/lib/core/sorteio";

describe("sorteio", () => {
  const xs = Array.from({ length: 11 }, (_, i) => i);
  it("embaralha sem perder ninguém", () => { expect([...embaralhar(xs)].sort((a, b) => a - b)).toEqual(xs); });
  it("grupos equilibrados", () => {
    const g = grupos(xs, 3); expect(g.map((x) => x.length).sort()).toEqual([3, 4, 4]); expect(g.flat().sort((a, b) => a - b)).toEqual(xs);
  });
  it("por tamanho", () => { expect(gruposPorTamanho(xs, 4).length).toBe(3); expect(gruposPorTamanho([], 3)).toEqual([[]]); });
});
import { lerLinks, semanaDe } from "@/lib/core/semana";
describe("semana", () => {
  it("acha a segunda-feira", () => { expect(semanaDe("2026-11-24")).toBe("2026-11-23"); expect(semanaDe("2026-11-23")).toBe("2026-11-23"); expect(semanaDe("2026-11-29")).toBe("2026-11-23"); });
  it("só aceita links http(s)", () => {
    expect(lerLinks("Vídeo | https://youtu.be/x\njavascript:alert(1)\nsite.com\nhttp://a.com")).toEqual([{ label: "Vídeo", url: "https://youtu.be/x" }, { label: "http://a.com", url: "http://a.com/" }]);
  });
});
import { dividirAB } from "@/lib/core/listas";
describe("listas A/B", () => { it("reparte alternando, sem repetir", () => { const r = dividirAB([1, 2, 3, 4, 5]); expect(r.a).toEqual([1, 3, 5]); expect(r.b).toEqual([2, 4]); }); });
