import "server-only";
import PptxGenJS from "pptxgenjs";

export type Deck = { titulo: string; subtitulo?: string; slides: { titulo: string; topicos: string[]; notas?: string }[] };

/** Gera um .pptx limpo (16:9, azul Segunda Lousa): capa, um slide por tópico e notas do professor. */
export async function renderDeck(d: Deck): Promise<Buffer> {
  const p = new PptxGenJS();
  p.layout = "LAYOUT_16x9";
  p.title = d.titulo;
  p.author = "Segunda Lousa · GizIA";
  const AZUL = "2F5BEA", INK = "1B2540", SOFT = "5B6785";
  const capa = p.addSlide();
  capa.background = { color: AZUL };
  capa.addText(d.titulo, { x: 0.7, y: 2.0, w: 8.6, h: 1.6, fontFace: "Calibri", fontSize: 38, bold: true, color: "FFFFFF", valign: "middle" });
  if (d.subtitulo) capa.addText(d.subtitulo, { x: 0.7, y: 3.7, w: 8.6, h: 0.8, fontFace: "Calibri", fontSize: 20, color: "DCE5FF" });
  for (const s of d.slides.slice(0, 40)) {
    const sl = p.addSlide();
    sl.background = { color: "FFFFFF" };
    sl.addShape("rect", { x: 0, y: 0, w: 0.25, h: 5.625, fill: { color: AZUL }, line: { color: AZUL } });
    sl.addText(s.titulo, { x: 0.7, y: 0.4, w: 8.6, h: 0.9, fontFace: "Calibri", fontSize: 30, bold: true, color: INK, valign: "middle" });
    const topicos = s.topicos.slice(0, 8);
    if (topicos.length) sl.addText(topicos.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), { x: 0.8, y: 1.5, w: 8.4, h: 3.6, fontFace: "Calibri", fontSize: 22, color: SOFT, valign: "top", paraSpaceAfter: 10 });
    if (s.notas) sl.addNotes(s.notas);
  }
  return Buffer.from((await p.write({ outputType: "nodebuffer" })) as Buffer);
}
