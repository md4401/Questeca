import { describe, it, expect } from "vitest";
import { analyze, supportGroups } from "@/lib/core/analysis";

describe("SA-06 análise por item/habilidade", () => {
  const items = [{ position: 1, key: "A", points: 5, topics: ["fracoes"] }, { position: 2, key: "B", points: 5, topics: ["descontos-sucessivos"] }];
  const mk = (s: string, p: number, v: string) => ({ studentId: s, position: p, value: v, status: "answered" });
  it("conta acertos, erros e brancos só de quem tem leitura completa", () => {
    const resp = [mk("a", 1, "A"), mk("a", 2, "C"), mk("b", 1, "A"), mk("b", 2, "-"), mk("c", 1, "B")];
    const r = analyze(items, resp, 1, 4);
    expect(r.valid).toBe(2); // c incompleto
    expect(r.pending).toBe(1);
    expect(r.items[0]).toMatchObject({ correct: 2, wrong: 0, n: 2 });
    expect(r.items[1]).toMatchObject({ correct: 0, wrong: 1, blank: 1 });
    expect(r.topics[0].slug).toBe("descontos-sucessivos");
    expect(r.attention.map((t) => t.slug)).toEqual(["descontos-sucessivos"]);
    expect(r.smallSample).toBe(true);
  });
  it("sem respostas: nada válido", () => {
    expect(analyze(items, [], 0, 10).valid).toBe(0);
  });
  it("ex.: 12 de 28 acertaram", () => {
    const resp: ReturnType<typeof mk>[] = [];
    for (let i = 0; i < 28; i++) { resp.push(mk(`s${i}`, 1, "A")); resp.push(mk(`s${i}`, 2, i < 12 ? "B" : "D")); }
    const r = analyze(items, resp, 0, 28);
    expect(r.items[1].correct).toBe(12);
    expect(Math.round(r.items[1].rate * 100)).toBe(43);
  });
});

describe("grupos de apoio sugeridos", () => {
  const items = [{ position: 1, key: "A", points: 5, topics: ["fracoes"] }, { position: 2, key: "B", points: 5, topics: ["fracoes", "decimais"] }];
  const mk = (s: string, p: number, v: string) => ({ studentId: s, position: p, value: v, status: "answered" });
  it("agrupa quem errou a maioria dos itens do conteúdo fraco", () => {
    const resp = [mk("a", 1, "C"), mk("a", 2, "C"), mk("b", 1, "A"), mk("b", 2, "B"), mk("c", 1, "C"), mk("c", 2, "A")];
    const g = supportGroups(items, resp, new Map([["a", "Ana"], ["b", "Bia"], ["c", "Caio"]]));
    expect(g[0].students).toEqual(["Ana", "Caio"]);
    expect(g.every((x) => !x.students.includes("Bia"))).toBe(true);
  });
  it("ignora quem não tem leitura completa", () => {
    expect(supportGroups(items, [mk("a", 1, "C")], new Map([["a", "Ana"]]))).toEqual([]);
  });
});
