import "server-only";
import PptxGenJS from "pptxgenjs";
import { temaPorId, type Deck, type Slide, type TemaDeck } from "@/lib/core/deck";

const W = 10, H = 5.625, M = 0.65;
const MUTED = "6B7280";

/** Mistura duas cores hex (t = 0 → a, 1 → b). Usada para tons de texto que combinam com o tema. */
const mix = (a: string, b: string, t: number) => { const f = (i: number) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0"); return `${f(0)}${f(2)}${f(4)}`.toUpperCase(); };

/** Gera um .pptx completo: tema (cores e fontes), 10 modelos de slide, fotos com crédito, ilustração geométrica quando não há foto e notas de fala. */
export async function renderDeck(d: Deck): Promise<Buffer> {
  const t: TemaDeck = temaPorId(d.tema);
  const corpo = mix(t.escuro, "FFFFFF", 0.18);
  const p = new PptxGenJS();
  p.layout = "LAYOUT_16x9"; p.title = d.titulo; p.author = "Segunda Lousa · GizIA";
  const R = p.ShapeType;

  /** Círculos decorativos (ilustração do tema) num retângulo da tela. */
  const arte = (sl: PptxGenJS.Slide, x: number, y: number, w: number, h: number, dark: boolean) => {
    const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
    sl.addShape(R.ellipse, { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill: { color: dark ? t.primaria : t.secundaria, transparency: dark ? 55 : 0 }, line: { color: dark ? t.primaria : t.secundaria, transparency: 100 } });
    sl.addShape(R.ellipse, { x: cx - r * 0.62, y: cy - r * 0.62, w: r * 1.24, h: r * 1.24, fill: { color: t.primaria, transparency: dark ? 35 : 15 }, line: { color: t.primaria, transparency: 100 } });
    sl.addShape(R.ellipse, { x: cx + r * 0.35, y: cy - r * 0.95, w: r * 0.6, h: r * 0.6, fill: { color: t.destaque }, line: { color: t.destaque, transparency: 100 } });
    sl.addShape(R.ellipse, { x: cx - r * 0.2, y: cy - r * 0.2, w: r * 0.4, h: r * 0.4, fill: { color: "FFFFFF", transparency: 25 }, line: { color: "FFFFFF", transparency: 100 } });
  };
  const foto = (sl: PptxGenJS.Slide, chave: string, x: number, y: number, w: number, h: number, dark = false) => {
    const im = d.imagens?.[chave];
    if (!im) { arte(sl, x, y, w, h, dark); return; }
    sl.addImage({ data: im.dataUrl, x, y, w, h, sizing: { type: "cover", w, h } });
    sl.addText(im.credito, { x, y: y + h + 0.03, w, h: 0.22, fontFace: t.fonteCorpo, fontSize: 7, color: MUTED, align: "right" });
  };
  const fundo = (sl: PptxGenJS.Slide, cor: string) => { sl.background = { color: cor }; };
  const titulo = (sl: PptxGenJS.Slide, texto: string, cor = t.escuro, w = W - 2 * M) => {
    sl.addText(texto, { x: M, y: 0.4, w, h: 0.85, fontFace: t.fonteTitulo, fontSize: texto.length > 48 ? 24 : 28, bold: true, color: cor, valign: "middle", margin: 0 });
    sl.addShape(R.rect, { x: M, y: 1.3, w: 0.9, h: 0.06, fill: { color: t.destaque }, line: { color: t.destaque, transparency: 100 } });
  };
  const rodape = (sl: PptxGenJS.Slide, n: number, cor = MUTED) => {
    sl.addText(d.titulo, { x: M, y: H - 0.42, w: 6, h: 0.3, fontFace: t.fonteCorpo, fontSize: 9, color: cor, margin: 0 });
    sl.addText(String(n), { x: W - M - 1, y: H - 0.42, w: 1, h: 0.3, fontFace: t.fonteCorpo, fontSize: 9, color: cor, align: "right", margin: 0 });
  };

  // ---- capa
  const capa = p.addSlide(); fundo(capa, t.escuro);
  if (d.imagens?.capa) {
    capa.addImage({ data: d.imagens.capa.dataUrl, x: 5.4, y: 0, w: 4.6, h: H, sizing: { type: "cover", w: 4.6, h: H } });
    capa.addShape(R.rect, { x: 5.4, y: 0, w: 4.6, h: H, fill: { color: t.escuro, transparency: 70 }, line: { color: t.escuro, transparency: 100 } });
    capa.addText(d.imagens.capa.credito, { x: 5.4, y: H - 0.3, w: 4.5, h: 0.25, fontFace: t.fonteCorpo, fontSize: 7, color: "FFFFFF", align: "right", transparency: 25 });
  } else arte(capa, 5.6, 0.6, 4.1, 4.1, true);
  capa.addShape(R.rect, { x: M, y: 1.55, w: 0.9, h: 0.08, fill: { color: t.destaque }, line: { color: t.destaque, transparency: 100 } });
  capa.addText(d.titulo, { x: M, y: 1.75, w: d.imagens?.capa ? 4.5 : 4.7, h: 1.9, fontFace: t.fonteTitulo, fontSize: d.titulo.length > 40 ? 30 : 38, bold: true, color: "FFFFFF", valign: "top", margin: 0 });
  if (d.subtitulo) capa.addText(d.subtitulo, { x: M, y: 3.75, w: 4.5, h: 0.9, fontFace: t.fonteCorpo, fontSize: 16, color: t.secundaria, valign: "top", margin: 0 });

  let n = 1;
  const slide = (s: Slide, i: number) => {
    n++;
    const sl = p.addSlide();
    switch (s.layout) {
      case "secao": {
        fundo(sl, t.primaria);
        sl.addText(String(i + 1).padStart(2, "0"), { x: M, y: 0.7, w: 3, h: 1.6, fontFace: t.fonteTitulo, fontSize: 90, bold: true, color: "FFFFFF", transparency: 70, margin: 0 });
        sl.addText(s.titulo, { x: M, y: 2.35, w: 8, h: 1.2, fontFace: t.fonteTitulo, fontSize: 36, bold: true, color: "FFFFFF", valign: "top", margin: 0 });
        if (s.subtitulo) sl.addText(s.subtitulo, { x: M, y: 3.6, w: 7.5, h: 0.8, fontFace: t.fonteCorpo, fontSize: 16, color: t.secundaria, valign: "top", margin: 0 });
        sl.addShape(R.rect, { x: M, y: 2.2, w: 0.9, h: 0.07, fill: { color: t.destaque }, line: { color: t.destaque, transparency: 100 } });
        break;
      }
      case "topicos": {
        fundo(sl, t.claro); titulo(sl, s.titulo);
        const comFoto = !!s.imagem; const largura = comFoto ? 5.1 : W - 2 * M;
        const linhas = s.topicos.length || 1; const passo = Math.min(0.82, 3.35 / linhas);
        s.topicos.forEach((tp, k) => {
          const y = 1.7 + k * passo;
          sl.addShape(R.ellipse, { x: M, y: y + 0.1, w: 0.16, h: 0.16, fill: { color: k % 2 ? t.destaque : t.primaria }, line: { color: t.primaria, transparency: 100 } });
          sl.addText(tp, { x: M + 0.35, y, w: largura - 0.35, h: passo - 0.05, fontFace: t.fonteCorpo, fontSize: 18, color: corpo, valign: "top", margin: 0 });
        });
        if (comFoto) foto(sl, String(i), 6.15, 1.55, 3.2, 3.2);
        rodape(sl, n); break;
      }
      case "destaque": {
        fundo(sl, t.escuro);
        sl.addShape(R.rect, { x: M, y: 1.1, w: 0.1, h: 2.9, fill: { color: t.destaque }, line: { color: t.destaque, transparency: 100 } });
        sl.addText(s.titulo, { x: M + 0.4, y: 1.0, w: 8.2, h: 2.5, fontFace: t.fonteTitulo, fontSize: s.titulo.length > 70 ? 28 : 34, bold: true, color: "FFFFFF", valign: "middle", margin: 0 });
        if (s.apoio) sl.addText(s.apoio, { x: M + 0.4, y: 3.55, w: 8, h: 0.7, fontFace: t.fonteCorpo, fontSize: 16, color: t.secundaria, valign: "top", margin: 0 });
        rodape(sl, n, mix(t.escuro, "FFFFFF", 0.5)); break;
      }
      case "numero": {
        fundo(sl, t.claro);
        sl.addShape(R.roundRect, { x: M, y: 1.0, w: 4.0, h: 3.3, rectRadius: 0.15, fill: { color: t.primaria }, line: { color: t.primaria, transparency: 100 } });
        sl.addText(s.numero, { x: M, y: 1.0, w: 4.0, h: 3.3, fontFace: t.fonteTitulo, fontSize: s.numero.length > 6 ? 54 : 72, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
        sl.addText(s.titulo, { x: 5.2, y: 1.3, w: 4.2, h: 1.6, fontFace: t.fonteTitulo, fontSize: 26, bold: true, color: t.escuro, valign: "top", margin: 0 });
        if (s.apoio) sl.addText(s.apoio, { x: 5.2, y: 3.0, w: 4.1, h: 1.3, fontFace: t.fonteCorpo, fontSize: 16, color: corpo, valign: "top", margin: 0 });
        rodape(sl, n); break;
      }
      case "citacao": {
        fundo(sl, t.secundaria);
        sl.addText("“", { x: M, y: 0.4, w: 2, h: 1.8, fontFace: "Georgia", fontSize: 130, bold: true, color: t.primaria, margin: 0 });
        sl.addText(s.texto, { x: M + 0.2, y: 1.7, w: 8.3, h: 2.2, fontFace: "Georgia", fontSize: s.texto.length > 120 ? 22 : 26, italic: true, color: t.escuro, valign: "top", margin: 0 });
        if (s.autor) sl.addText(`— ${s.autor}`, { x: M + 0.2, y: 4.0, w: 8, h: 0.5, fontFace: t.fonteCorpo, fontSize: 14, bold: true, color: t.primaria, margin: 0 });
        rodape(sl, n, mix(t.secundaria, t.escuro, 0.5)); break;
      }
      case "comparacao": {
        fundo(sl, t.claro); titulo(sl, s.titulo);
        const col = (x: number, c: typeof s.esquerda, cor: string) => {
          sl.addShape(R.roundRect, { x, y: 1.65, w: 4.1, h: 3.0, rectRadius: 0.1, fill: { color: "FFFFFF" }, line: { color: t.secundaria, width: 1.25 } });
          sl.addShape(R.rect, { x, y: 1.65, w: 4.1, h: 0.55, fill: { color: cor }, line: { color: cor, transparency: 100 } });
          sl.addText(c.titulo, { x: x + 0.2, y: 1.65, w: 3.7, h: 0.55, fontFace: t.fonteTitulo, fontSize: 16, bold: true, color: "FFFFFF", valign: "middle", margin: 0 });
          const passo = Math.min(0.62, 2.3 / Math.max(c.topicos.length, 1));
          c.topicos.forEach((tp, k) => sl.addText(`•  ${tp}`, { x: x + 0.2, y: 2.35 + k * passo, w: 3.7, h: passo - 0.04, fontFace: t.fonteCorpo, fontSize: 14, color: corpo, valign: "top", margin: 0 }));
        };
        col(M, s.esquerda, t.primaria); col(W - M - 4.1, s.direita, t.destaque === "FFFFFF" ? t.primaria : mix(t.destaque, t.escuro, 0.25));
        rodape(sl, n); break;
      }
      case "linha_do_tempo": {
        fundo(sl, t.claro); titulo(sl, s.titulo);
        const k = s.eventos.length; const larg = (W - 2 * M) / k;
        sl.addShape(R.rect, { x: M, y: 2.95, w: W - 2 * M, h: 0.05, fill: { color: t.secundaria }, line: { color: t.secundaria, transparency: 100 } });
        s.eventos.forEach((e, j) => {
          const x = M + j * larg;
          sl.addShape(R.ellipse, { x: x + larg / 2 - 0.16, y: 2.82, w: 0.32, h: 0.32, fill: { color: j % 2 ? t.destaque : t.primaria }, line: { color: "FFFFFF", width: 2 } });
          sl.addText(e.quando, { x: x + 0.05, y: 2.15, w: larg - 0.1, h: 0.5, fontFace: t.fonteTitulo, fontSize: 16, bold: true, color: t.primaria, align: "center", valign: "bottom", margin: 0 });
          sl.addText(e.texto, { x: x + 0.1, y: 3.35, w: larg - 0.2, h: 1.3, fontFace: t.fonteCorpo, fontSize: 13, color: corpo, align: "center", valign: "top", margin: 0 });
        });
        rodape(sl, n); break;
      }
      case "imagem": {
        const im = d.imagens?.[String(i)];
        if (im) {
          sl.addImage({ data: im.dataUrl, x: 0, y: 0, w: W, h: H, sizing: { type: "cover", w: W, h: H } });
          sl.addShape(R.rect, { x: 0, y: H - 1.35, w: W, h: 1.35, fill: { color: t.escuro, transparency: 25 }, line: { color: t.escuro, transparency: 100 } });
          if (s.titulo) sl.addText(s.titulo, { x: M, y: H - 1.25, w: 8.6, h: 0.6, fontFace: t.fonteTitulo, fontSize: 24, bold: true, color: "FFFFFF", valign: "middle", margin: 0 });
          sl.addText([s.imagem.legenda, im.credito].filter(Boolean).join("  ·  "), { x: M, y: H - 0.65, w: 8.7, h: 0.45, fontFace: t.fonteCorpo, fontSize: 11, color: t.secundaria, valign: "top", margin: 0 });
        } else {
          fundo(sl, t.escuro); arte(sl, 5.2, 0.5, 4.4, 4.4, true);
          sl.addText(s.titulo ?? s.imagem.legenda ?? "", { x: M, y: 1.6, w: 4.3, h: 1.8, fontFace: t.fonteTitulo, fontSize: 28, bold: true, color: "FFFFFF", valign: "middle", margin: 0 });
          if (s.imagem.legenda && s.titulo) sl.addText(s.imagem.legenda, { x: M, y: 3.45, w: 4.3, h: 0.9, fontFace: t.fonteCorpo, fontSize: 14, color: t.secundaria, valign: "top", margin: 0 });
        }
        break;
      }
      case "atividade": {
        fundo(sl, t.claro);
        sl.addShape(R.rect, { x: 0, y: 0, w: 3.2, h: H, fill: { color: t.destaque }, line: { color: t.destaque, transparency: 100 } });
        sl.addShape(R.ellipse, { x: 0.55, y: 1.0, w: 2.1, h: 2.1, fill: { color: "FFFFFF", transparency: 70 }, line: { color: "FFFFFF", transparency: 100 } });
        sl.addText("✎", { x: 0.55, y: 1.0, w: 2.1, h: 2.1, fontFace: "Segoe UI Symbol", fontSize: 60, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
        sl.addText("ATIVIDADE", { x: 0.3, y: 3.3, w: 2.6, h: 0.5, fontFace: t.fonteTitulo, fontSize: 16, bold: true, color: t.escuro, align: "center", margin: 0 });
        sl.addText(s.titulo, { x: 3.7, y: 0.5, w: 5.7, h: 0.8, fontFace: t.fonteTitulo, fontSize: 26, bold: true, color: t.escuro, valign: "middle", margin: 0 });
        sl.addText(s.enunciado, { x: 3.7, y: 1.4, w: 5.7, h: 1.4, fontFace: t.fonteCorpo, fontSize: 17, color: corpo, valign: "top", margin: 0 });
        s.passos.forEach((ps, k) => {
          const y = 2.95 + k * 0.5;
          sl.addShape(R.ellipse, { x: 3.7, y: y + 0.02, w: 0.34, h: 0.34, fill: { color: t.primaria }, line: { color: t.primaria, transparency: 100 } });
          sl.addText(String(k + 1), { x: 3.7, y: y + 0.02, w: 0.34, h: 0.34, fontFace: t.fonteTitulo, fontSize: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
          sl.addText(ps, { x: 4.2, y, w: 5.2, h: 0.42, fontFace: t.fonteCorpo, fontSize: 14, color: corpo, valign: "middle", margin: 0 });
        });
        break;
      }
      case "encerramento": {
        fundo(sl, t.escuro); arte(sl, 6.2, 0.9, 3.6, 3.6, true);
        sl.addShape(R.rect, { x: M, y: 1.7, w: 0.9, h: 0.08, fill: { color: t.destaque }, line: { color: t.destaque, transparency: 100 } });
        sl.addText(s.titulo, { x: M, y: 1.9, w: 5.2, h: 1.5, fontFace: t.fonteTitulo, fontSize: 36, bold: true, color: "FFFFFF", valign: "top", margin: 0 });
        if (s.apoio) sl.addText(s.apoio, { x: M, y: 3.5, w: 5.2, h: 1.0, fontFace: t.fonteCorpo, fontSize: 16, color: t.secundaria, valign: "top", margin: 0 });
        break;
      }
    }
    if ("notas" in s && s.notas) sl.addNotes(s.notas);
  };
  d.slides.forEach(slide);
  return Buffer.from((await p.write({ outputType: "nodebuffer" })) as Buffer);
}
