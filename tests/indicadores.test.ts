import { describe, it, expect } from "vitest";
import { atividadesPendentes } from "@/lib/core/indicadores";

describe("atividades pendentes", () => {
  const itens = [{ id: "a", classId: "t1" }, { id: "b", classId: "t1" }, { id: "c", classId: "t2" }];
  it("conta atividades em que falta nota de algum aluno ativo", () => {
    const ativos = new Map([["t1", 30], ["t2", 25]]);
    expect(atividadesPendentes(itens, ativos, new Map([["a", 30], ["b", 29], ["c", 25]]))).toBe(1);
    expect(atividadesPendentes(itens, ativos, new Map())).toBe(3);
    expect(atividadesPendentes(itens, ativos, new Map([["a", 30], ["b", 30], ["c", 25]]))).toBe(0);
  });
  it("turma sem alunos ativos não gera pendência", () => {
    expect(atividadesPendentes([{ id: "x", classId: "t9" }], new Map(), new Map())).toBe(0);
  });
});
