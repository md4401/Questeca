import { z } from "zod";

/** Temas visuais das apresentações. A GizIA escolhe pelo assunto; cada um tem paleta e fontes que combinam entre si. */
export type TemaDeck = { id: string; nome: string; para: string; escuro: string; claro: string; primaria: string; secundaria: string; destaque: string; fonteTitulo: string; fonteCorpo: string };
export const TEMAS_DECK: TemaDeck[] = [
  { id: "ceu", nome: "Céu", para: "matemática, ciências exatas, tecnologia", escuro: "14213D", claro: "F4F7FF", primaria: "2F5BEA", secundaria: "DCE6FF", destaque: "F5A524", fonteTitulo: "Calibri", fonteCorpo: "Calibri" },
  { id: "folha", nome: "Folha", para: "biologia, ecologia, geografia física, ciências da natureza", escuro: "0F3D2E", claro: "F2FAF5", primaria: "1F7A5C", secundaria: "D6EFE3", destaque: "F2B134", fonteTitulo: "Calibri", fonteCorpo: "Calibri" },
  { id: "terra", nome: "Terra", para: "história, geografia humana, sociologia", escuro: "3B2417", claro: "FBF5EE", primaria: "9A4F2A", secundaria: "F0DFCB", destaque: "C9A227", fonteTitulo: "Georgia", fonteCorpo: "Calibri" },
  { id: "bordo", nome: "Bordô", para: "literatura, língua portuguesa, redação, filosofia", escuro: "2B0F1A", claro: "FBF4F6", primaria: "7A1F3D", secundaria: "F2D9E1", destaque: "E3B04B", fonteTitulo: "Georgia", fonteCorpo: "Calibri" },
  { id: "oceano", nome: "Oceano", para: "química, física, astronomia", escuro: "0B2E3A", claro: "F0FAFC", primaria: "0E7490", secundaria: "D3EFF5", destaque: "FF7A59", fonteTitulo: "Calibri", fonteCorpo: "Calibri" },
  { id: "lilas", nome: "Lilás", para: "arte, música, línguas estrangeiras, projeto de vida", escuro: "241A4D", claro: "F6F3FF", primaria: "6D4AFF", secundaria: "E4DCFF", destaque: "FF6FB1", fonteTitulo: "Calibri", fonteCorpo: "Calibri" },
  { id: "sol", nome: "Sol", para: "turmas do 6º e 7º ano, temas leves e lúdicos", escuro: "4A2C00", claro: "FFFBEB", primaria: "F59E0B", secundaria: "FDE9B8", destaque: "2563EB", fonteTitulo: "Calibri", fonteCorpo: "Calibri" },
  { id: "grafite", nome: "Grafite", para: "neutro e sóbrio, qualquer assunto", escuro: "111827", claro: "F9FAFB", primaria: "374151", secundaria: "E5E7EB", destaque: "10B981", fonteTitulo: "Calibri", fonteCorpo: "Calibri" },
];
export const temaPorId = (id?: string) => TEMAS_DECK.find((t) => t.id === id) ?? TEMAS_DECK[0];

const txt = (max: number) => z.string().trim().min(1).max(max);
const imagem = z.object({ busca: txt(80).describe("termos de busca em inglês para achar uma foto livre"), legenda: z.string().trim().max(120).optional() }).optional();
const topicos = (n: number, max: number) => z.array(txt(max)).max(n).default([]);

/** Slides: cada `layout` tem só os campos que ele usa. Texto curto de propósito (um slide = uma ideia). */
export const slideSchema = z.discriminatedUnion("layout", [
  z.object({ layout: z.literal("topicos"), titulo: txt(70), topicos: topicos(5, 95), imagem, notas: z.string().max(1500).optional() }),
  z.object({ layout: z.literal("secao"), titulo: txt(70), subtitulo: z.string().trim().max(110).optional(), notas: z.string().max(1500).optional() }),
  z.object({ layout: z.literal("destaque"), titulo: txt(130), apoio: z.string().trim().max(140).optional(), notas: z.string().max(1500).optional() }),
  z.object({ layout: z.literal("numero"), numero: txt(14), titulo: txt(90), apoio: z.string().trim().max(140).optional(), notas: z.string().max(1500).optional() }),
  z.object({ layout: z.literal("citacao"), texto: txt(220), autor: z.string().trim().max(90).optional(), notas: z.string().max(1500).optional() }),
  z.object({ layout: z.literal("comparacao"), titulo: txt(70), esquerda: z.object({ titulo: txt(40), topicos: topicos(4, 80) }), direita: z.object({ titulo: txt(40), topicos: topicos(4, 80) }), notas: z.string().max(1500).optional() }),
  z.object({ layout: z.literal("linha_do_tempo"), titulo: txt(70), eventos: z.array(z.object({ quando: txt(22), texto: txt(80) })).min(2).max(5), notas: z.string().max(1500).optional() }),
  z.object({ layout: z.literal("imagem"), titulo: z.string().trim().max(70).optional(), imagem: z.object({ busca: txt(80), legenda: z.string().trim().max(120).optional() }), notas: z.string().max(1500).optional() }),
  z.object({ layout: z.literal("atividade"), titulo: txt(60), enunciado: txt(220), passos: topicos(4, 90), notas: z.string().max(1500).optional() }),
  z.object({ layout: z.literal("encerramento"), titulo: txt(70), apoio: z.string().trim().max(160).optional(), notas: z.string().max(1500).optional() }),
]);
export type Slide = z.infer<typeof slideSchema>;

export const deckSchema = z.object({
  titulo: txt(100), subtitulo: z.string().trim().max(120).optional(), tema: z.string().max(20).default("ceu"),
  capaImagem: z.object({ busca: txt(80) }).optional(),
  slides: z.array(slideSchema).min(3).max(16),
});
export type DeckEntrada = z.infer<typeof deckSchema>;
export type Credito = { slide: number; texto: string };
export type ImagemBaixada = { dataUrl: string; credito: string };
/** Deck pronto para renderizar: entrada + imagens já baixadas (índice do slide → imagem; "capa" para a capa). */
export type Deck = Omit<DeckEntrada, "tema"> & { tema: string; imagens?: Record<string, ImagemBaixada> };

/** Busca de imagem de cada slide (a ordem importa: o índice é a posição no array de slides). */
export function pedidosDeImagem(d: DeckEntrada): { chave: string; busca: string }[] {
  const out: { chave: string; busca: string }[] = [];
  if (d.capaImagem) out.push({ chave: "capa", busca: d.capaImagem.busca });
  d.slides.forEach((s, i) => { if ("imagem" in s && s.imagem) out.push({ chave: String(i), busca: s.imagem.busca }); });
  return out.slice(0, 6);
}

type SlideLegado = { titulo: string; topicos: string[]; notas?: string };
/** O que fica guardado no banco: o deck novo ou o formato antigo (só título e tópicos). */
export type DeckSalvo = Omit<Deck, "slides" | "tema"> & { tema?: string; slides: (Slide | SlideLegado)[] };
export function paraRender(d: DeckSalvo): Deck {
  return { ...d, tema: d.tema ?? "ceu", slides: d.slides.map((s) => ("layout" in s ? s : { layout: "topicos" as const, titulo: s.titulo, topicos: s.topicos.slice(0, 5), notas: s.notas })) };
}
