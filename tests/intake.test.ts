import { describe, it, expect } from "vitest";
import { podeCriar } from "@/lib/core/intake";

describe("trava de criação (entrevista antes de criar)", () => {
  const pedido = { role: "user" as const, content: "Monte uma prova de Machado de Assis" };
  it("primeiro pedido: bloqueia mesmo com confirmado=true", () => {
    const r = podeCriar([pedido], true);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toMatch(/entrevistou/);
  });
  it("depois de perguntar e o professor responder: libera só com confirmado=true", () => {
    const h = [pedido, { role: "assistant" as const, content: "1. Qual a série?\n2. Quantas questões?" }, { role: "user" as const, content: "2º ano, 10 questões" }];
    expect(podeCriar(h, undefined).ok).toBe(false);
    expect(podeCriar(h, false).ok).toBe(false);
    expect(podeCriar(h, true).ok).toBe(true);
  });
  it("resposta de erro da GizIA não conta como entrevista", () => {
    const h = [pedido, { role: "assistant" as const, content: "O assistente falhou?", isError: true }, { role: "user" as const, content: "tente de novo" }];
    expect(podeCriar(h, true).ok).toBe(false);
  });
  it("professor que pede para não perguntar é atendido", () => {
    expect(podeCriar([{ role: "user", content: "Faça uma apresentação sobre fotossíntese, pode criar direto" }], true).ok).toBe(true);
    expect(podeCriar([{ role: "user", content: "monte a prova sem perguntas" }], undefined).ok).toBe(true);
  });
  it("só conta pergunta feita ANTES da última mensagem do professor", () => {
    const h = [{ role: "user" as const, content: "oi" }, { role: "user" as const, content: "Quais alunos estão em risco? " }];
    expect(podeCriar(h, true).ok).toBe(false);
  });
});
