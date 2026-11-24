import { describe, it, expect } from "vitest";
import { deckSchema, TEMAS_DECK, temaPorId, pedidosDeImagem } from "@/lib/core/deck";

const base = { titulo: "Revolução Francesa", slides: [
  { layout: "secao", titulo: "Antes de 1789" }, { layout: "topicos", titulo: "Causas", topicos: ["Crise financeira", "Iluminismo"], imagem: { busca: "Bastille 1789 painting" } },
  { layout: "encerramento", titulo: "Perguntas?" },
] };

describe("apresentação: esquema e temas", () => {
  it("aceita layouts variados e aplica o tema padrão", () => {
    const d = deckSchema.parse(base);
    expect(d.tema).toBe("ceu"); expect(d.slides).toHaveLength(3);
  });
  it("rejeita layout desconhecido, slide sem título e texto longo demais", () => {
    expect(deckSchema.safeParse({ ...base, slides: [...base.slides.slice(0, 2), { layout: "inventado", titulo: "x" }] }).success).toBe(false);
    expect(deckSchema.safeParse({ ...base, slides: [...base.slides.slice(0, 2), { layout: "topicos", topicos: ["a"] }] }).success).toBe(false);
    expect(deckSchema.safeParse({ ...base, slides: [...base.slides.slice(0, 2), { layout: "topicos", titulo: "x".repeat(200) }] }).success).toBe(false);
  });
  it("poucos tópicos por slide: mais de 5 é recusado", () => {
    const seis = Array.from({ length: 6 }, (_, i) => `t${i}`);
    expect(deckSchema.safeParse({ ...base, slides: [...base.slides.slice(0, 2), { layout: "topicos", titulo: "x", topicos: seis }] }).success).toBe(false);
  });
  it("temas têm paleta completa e id único; tema desconhecido cai no padrão", () => {
    expect(new Set(TEMAS_DECK.map((t) => t.id)).size).toBe(TEMAS_DECK.length);
    for (const t of TEMAS_DECK) for (const c of [t.escuro, t.claro, t.primaria, t.secundaria, t.destaque]) expect(c).toMatch(/^[0-9A-F]{6}$/);
    expect(temaPorId("nao-existe").id).toBe("ceu");
  });
  it("pedidos de imagem seguem a posição dos slides e ficam em até 6", () => {
    const d = deckSchema.parse({ ...base, capaImagem: { busca: "french revolution" } });
    expect(pedidosDeImagem(d)).toEqual([{ chave: "capa", busca: "french revolution" }, { chave: "1", busca: "Bastille 1789 painting" }]);
  });
});
