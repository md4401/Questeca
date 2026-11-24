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

import { semanasRecentes, acumuladoMensal, mediaDe, mensagemDesempenho } from "@/lib/core/indicadores";
describe("séries e desempenho do Início", () => {
  const hoje = new Date("2026-11-24T15:00:00Z"); // terça
  it("conta por semana (seg–dom), da mais antiga para a atual", () => {
    const d = [new Date("2026-11-23T10:00:00Z"), new Date("2026-11-24T10:00:00Z"), new Date("2026-11-16T10:00:00Z"), new Date("2026-09-01T10:00:00Z")];
    expect(semanasRecentes(d, hoje, 4)).toEqual([0, 0, 1, 2]);
  });
  it("acumulado mensal inclui o que já existia antes da janela", () => {
    const d = [new Date("2026-01-10T10:00:00Z"), new Date("2026-10-05T10:00:00Z"), new Date("2026-11-02T10:00:00Z")];
    expect(acumuladoMensal(d, hoje, 3)).toEqual([1, 2, 3]);
  });
  it("média e mensagens por faixa", () => {
    expect(mediaDe([])).toBeNull(); expect(mediaDe([6, 8])).toBe(7);
    expect(mensagemDesempenho(null).tom).toBe("vazio");
    expect(mensagemDesempenho(6.8, 6).tom).toBe("atencao");
    expect(mensagemDesempenho(7.5, 6).tom).toBe("ok");
    expect(mensagemDesempenho(4.2, 6).tom).toBe("risco");
  });
});
