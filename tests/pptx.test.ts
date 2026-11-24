import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { renderDeck } from "@/lib/assistente/pptx";
import { deckSchema, TEMAS_DECK, paraRender } from "@/lib/core/deck";

// PNG 1×1 (válido) só para exercitar o encaixe de foto
const PNG = "image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const deck = deckSchema.parse({
  titulo: "Revolução Francesa", subtitulo: "8º ano · História", tema: "terra", capaImagem: { busca: "Liberty Leading the People" },
  slides: [
    { layout: "destaque", titulo: "O que faz um povo derrubar um rei?", apoio: "Pense em exemplos de hoje", notas: "Abra com a pergunta." },
    { layout: "secao", titulo: "Antes de 1789", subtitulo: "O Antigo Regime" },
    { layout: "topicos", titulo: "Três estados, um peso desigual", topicos: ["Clero: privilégios", "Nobreza: isenções", "Povo: impostos"], imagem: { busca: "Bastille 1789" }, notas: "Explique os estamentos." },
    { layout: "numero", numero: "1789", titulo: "Ano da tomada da Bastilha", apoio: "14 de julho" },
    { layout: "linha_do_tempo", titulo: "Do Antigo Regime ao Terror", eventos: [{ quando: "1789", texto: "Tomada da Bastilha" }, { quando: "1791", texto: "Constituição" }, { quando: "1793", texto: "Terror" }] },
    { layout: "comparacao", titulo: "Girondinos × Jacobinos", esquerda: { titulo: "Girondinos", topicos: ["Moderados", "Burguesia"] }, direita: { titulo: "Jacobinos", topicos: ["Radicais", "Povo urbano"] } },
    { layout: "citacao", texto: "Liberdade, igualdade e fraternidade.", autor: "Lema da Revolução" },
    { layout: "imagem", titulo: "A Liberdade guiando o povo", imagem: { busca: "Delacroix", legenda: "Delacroix, 1830" } },
    { layout: "atividade", titulo: "Em duplas", enunciado: "Compare a situação de cada estado antes da revolução.", passos: ["Liste 2 privilégios", "Liste 2 obrigações"] },
    { layout: "encerramento", titulo: "Perguntas?", apoio: "Próxima aula: Napoleão" },
  ],
});
const slidesNoZip = (b: Buffer) => new Set([...b.toString("latin1").matchAll(/ppt\/slides\/slide(\d+)\.xml/g)].map((m) => m[1])).size;

describe("renderDeck", () => {
  it("gera um .pptx válido com capa + todos os slides, em todos os 10 modelos", async () => {
    const b = await renderDeck(paraRender(deck));
    expect(b.subarray(0, 2).toString()).toBe("PK");
    expect(slidesNoZip(b)).toBe(deck.slides.length + 1);
  });
  it("embute fotos quando existem e usa a ilustração do tema quando não", async () => {
    const sem = await renderDeck(paraRender(deck));
    const com = await renderDeck({ ...paraRender(deck), imagens: { capa: { dataUrl: PNG, credito: "Foto: X / Wikimedia Commons / CC BY 4.0" }, "2": { dataUrl: PNG, credito: "Foto: Y / Wikimedia Commons / CC0" }, "7": { dataUrl: PNG, credito: "Foto: Z / Wikimedia Commons / Public domain" } } });
    expect(/ppt\/media\/image/.test(com.toString("latin1"))).toBe(true);
    expect(/ppt\/media\/image\d+\.png/.test(sem.toString("latin1"))).toBe(false);
  });
  it("renderiza todos os temas", async () => {
    for (const t of TEMAS_DECK) expect(slidesNoZip(await renderDeck({ ...paraRender(deck), tema: t.id }))).toBe(deck.slides.length + 1);
  });
  it("aceita o formato antigo (só título e tópicos)", async () => {
    const legado = paraRender({ titulo: "Antigo", slides: [{ titulo: "Um", topicos: ["a", "b"] }, { titulo: "Dois", topicos: ["c"] }, { titulo: "Três", topicos: [] }] });
    expect(slidesNoZip(await renderDeck(legado))).toBe(4);
  });
});
