import "server-only";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import type { Snapshot } from "@/lib/assessments";
import { topicName } from "@/lib/taxonomy";

const FONT_DIR = (pkg: string) => path.join(process.cwd(), "node_modules", "@fontsource", pkg, "files");
const read = (pkg: string, file: string) => fs.readFileSync(path.join(FONT_DIR(pkg), file));

const A4 = { w: 595.28, h: 841.89 };
const M = { l: 56, r: 56, t: 56, b: 64 };

async function loadFonts(doc: PDFDocument) {
  doc.registerFontkit(fontkit);
  const [sans, sansBold, serif, serifBold] = await Promise.all([
    doc.embedFont(read("dm-sans", "dm-sans-latin-400-normal.woff"), { subset: true }),
    doc.embedFont(read("dm-sans", "dm-sans-latin-700-normal.woff"), { subset: true }),
    doc.embedFont(read("spectral", "spectral-latin-400-normal.woff"), { subset: true }),
    doc.embedFont(read("spectral", "spectral-latin-600-normal.woff"), { subset: true }),
  ]);
  return { sans, sansBold, serif, serifBold };
}

const FALLBACK: Record<string, string> = { "π": "pi", "√": "raiz", "≤": "<=", "≥": ">=", "≠": "!=", "≈": "~", "∞": "inf", "α": "a", "β": "b", "θ": "teta", "Δ": "delta", "∠": "angulo", "→": "->", "⁵": "^5", "⁴": "^4", "⁶": "^6", "·": "." };

function clean(text: string, font: PDFFont) {
  const set = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of text.normalize("NFC").replace(/\r/g, "")) {
    if (ch === "\n" || ch === "\t") { out += ch === "\t" ? "  " : ch; continue; }
    if (set.has(ch.codePointAt(0)!)) out += ch;
    else if (FALLBACK[ch]) out += FALLBACK[ch];
    else if (ch === " ") out += " ";
    else out += "?";
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  for (const para of clean(text, font).split("\n")) {
    if (!para.trim()) { lines.push(""); continue; }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxW) line = test;
      else { if (line) lines.push(line); line = word; }
    }
    if (line) lines.push(line);
  }
  return lines;
}

class Doc {
  doc!: PDFDocument; page!: PDFPage; y = 0; f!: Awaited<ReturnType<typeof loadFonts>>;
  warnings: string[] = []; pages: PDFPage[] = [];
  constructor(public scale = 1) {}
  static async create(scale = 1) { const d = new Doc(scale); d.doc = await PDFDocument.create(); d.f = await loadFonts(d.doc); d.newPage(); return d; }
  newPage() { this.page = this.doc.addPage([A4.w, A4.h]); this.pages.push(this.page); this.y = A4.h - M.t; }
  get width() { return A4.w - M.l - M.r; }
  need(h: number) { if (this.y - h < M.b) this.newPage(); }
  text(t: string, o: { font?: PDFFont; size?: number; x?: number; color?: [number, number, number]; maxW?: number; lineGap?: number } = {}) {
    const font = o.font ?? this.f.sans; const size = (o.size ?? 10) * this.scale; const maxW = o.maxW ?? this.width; const gap = (o.lineGap ?? 3) * this.scale;
    for (const l of wrap(t, font, size, maxW)) {
      this.need(size + gap);
      this.y -= size;
      if (l) this.page.drawText(l, { x: o.x ?? M.l, y: this.y, size, font, color: rgb(...(o.color ?? [0, 0, 0])) });
      this.y -= gap;
    }
  }
  height(t: string, font: PDFFont, size: number, maxW: number, gap = 3) { return wrap(t, font, size * this.scale, maxW).length * (size * this.scale + gap * this.scale); }
  rule(gray = 0.75) { this.y -= 4; this.page.drawLine({ start: { x: M.l, y: this.y }, end: { x: A4.w - M.r, y: this.y }, thickness: 0.7, color: rgb(gray, gray, gray) }); this.y -= 8; }
  gap(n: number) { this.y -= n; }
  footer(left: string) {
    const total = this.pages.length;
    this.pages.forEach((p, i) => {
      const t = `${clean(left, this.f.sans)}`;
      p.drawText(t, { x: M.l, y: 30, size: 8, font: this.f.sans, color: rgb(0.35, 0.35, 0.35) });
      const r = `Página ${i + 1} de ${total}`;
      p.drawText(r, { x: A4.w - M.r - this.f.sans.widthOfTextAtSize(r, 8), y: 30, size: 8, font: this.f.sans, color: rgb(0.35, 0.35, 0.35) });
    });
  }
}

export type Header = NonNullable<Snapshot["header"]> & { logoDataUrl?: string };

async function drawHeader(d: Doc, header: Header, ctx: { teacher?: string; className?: string; subject?: string; title: string; instructions?: string; student: boolean }) {
  const top = d.y;
  let x = M.l;
  if (header.logoDataUrl?.startsWith("data:image/")) {
    try {
      const b64 = header.logoDataUrl.split(",")[1];
      const bytes = Buffer.from(b64, "base64");
      const img = header.logoDataUrl.includes("png") ? await d.doc.embedPng(bytes) : await d.doc.embedJpg(bytes);
      const sc = Math.min(48 / img.width, 48 / img.height);
      d.page.drawImage(img, { x: M.l, y: top - img.height * sc, width: img.width * sc, height: img.height * sc });
      x = M.l + img.width * sc + 12;
    } catch { d.warnings.push("Não foi possível usar o logo cadastrado."); }
  }
  d.page.drawText(clean(header.schoolName || "Escola", d.f.sansBold), { x, y: top - 14, size: 14 * d.scale, font: d.f.sansBold });
  if (header.subtitle) d.page.drawText(clean(header.subtitle, d.f.sans), { x, y: top - 30, size: 10 * d.scale, font: d.f.sans, color: rgb(0.25, 0.25, 0.25) });
  d.y = top - 56;
  d.rule();
  if (ctx.student) {
    const labels = header.fields?.length ? header.fields : ["Aluno", "Turma", "Data", "Nota"];
    const line = (a: string, b: string) => { d.text(`${a}: ______________________________    ${b}`, { size: 10 }); d.gap(4); };
    const has = (k: string) => labels.includes(k);
    d.text(`${header.teacherLabel ?? "Professor(a)"}: ${ctx.teacher ?? ""}      Disciplina: ${ctx.subject ?? "Matemática"}      Turma: ${ctx.className ?? "______"}`, { size: 10 });
    d.gap(6);
    if (has("Aluno")) line("Aluno(a)", has("Data") ? "Data: ____/____/______" : "");
    if (has("Nota")) d.text("Nota: ________    Valor total: ________", { size: 10 });
    d.gap(2);
    d.rule();
  } else {
    d.text(`Professor(a): ${ctx.teacher ?? ""}      Turma: ${ctx.className ?? ""}`, { size: 10 });
    d.gap(2);
  }
  d.text(ctx.title, { font: d.f.serifBold, size: 15, x: M.l });
  d.gap(2);
  if (ctx.instructions) { d.text(ctx.instructions, { size: 9, color: [0.2, 0.2, 0.2] }); d.gap(4); }
}

export type ExamOpts = { mode: "student" | "teacher"; teacher?: string; className?: string; bigFont?: boolean; versionLabel: string };

export async function renderExam(snap: Snapshot, opts: ExamOpts): Promise<{ bytes: Uint8Array; warnings: string[] }> {
  const d = await Doc.create(opts.bigFont ? 1.2 : 1);
  const header = (snap.header ?? {}) as Header;
  const student = opts.mode === "student";
  if (!header.schoolName) d.warnings.push("Cabeçalho da escola não configurado: usando cabeçalho genérico.");
  await drawHeader(d, header, { teacher: opts.teacher, className: opts.className, title: student ? snap.title : `Gabarito — ${snap.title}`, instructions: student ? header.instructions : "Documento do professor. Não distribuir aos alunos.", student });

  if (student) {
    snap.items.forEach((it, i) => {
      const stmt = `${i + 1}. ${it.statement ?? ""}`;
      const pts = `(${Number(it.points).toLocaleString("pt-BR")} pt)`;
      const alts = it.alternatives.map((a) => `${a.key}) ${a.text}`);
      const h = d.height(stmt, d.f.serif, 11, d.width) + alts.reduce((s, a) => s + d.height(a, d.f.serif, 11, d.width - 14), 0) + 20;
      const avail = d.y - M.b;
      if (h > avail && h < A4.h - M.t - M.b) d.newPage();
      else if (h >= A4.h - M.t - M.b) d.warnings.push(`A questão ${i + 1} é maior que uma página e será dividida.`);
      d.text(`${stmt}  ${pts}`, { font: d.f.serif, size: 11 });
      d.gap(2 * d.scale);
      for (const a of alts) d.text(a, { font: d.f.serif, size: 11, x: M.l + 14, maxW: d.width - 14, lineGap: 2 });
      d.gap(10 * d.scale);
    });
  } else {
    d.text("Gabarito e referências", { font: d.f.sansBold, size: 11 });
    d.gap(4);
    snap.items.forEach((it, i) => {
      const src = it.institution === "Questeca" ? "Banco autoral Questeca" : `${it.institution} ${it.exam} ${it.year}${it.booklet ? ` · caderno ${it.booklet}` : ""}${it.number ? ` · questão ${it.number}` : ""}${it.page ? ` · p. ${it.page}` : ""}`;
      d.text(`${i + 1}. Resposta: ${it.answer}   ·   ${Number(it.points).toLocaleString("pt-BR")} pt   ·   ${src}`, { font: d.f.sansBold, size: 10 });
      d.text(`Conteúdos: ${it.assessed.map(topicName).join(", ")}${it.prerequisites.length ? ` · Pré-requisitos: ${it.prerequisites.map(topicName).join(", ")}` : ""} · Dificuldade ${it.difficulty}/5 (estimada) · ${Math.round(it.estSeconds / 60 * 10) / 10} min (estimado)`, { size: 9, color: [0.25, 0.25, 0.25], x: M.l + 12, maxW: d.width - 12 });
      if (it.sourceUrl) d.text(`Fonte: ${it.sourceUrl}`, { size: 8, color: [0.3, 0.3, 0.3], x: M.l + 12, maxW: d.width - 12 });
      d.gap(5);
    });
    d.gap(4);
    d.text("Resolução comentada: não informada. Quando houver, será identificada como nota pedagógica.", { size: 8.5, color: [0.35, 0.35, 0.35] });
  }
  d.footer(`${header.footer ? header.footer + " · " : ""}${opts.versionLabel}`);
  return { bytes: await d.doc.save(), warnings: d.warnings };
}

export async function renderAnswerCards(opts: { appTitle: string; versionLabel: string; code: string; itemCount: number; students: { id: string; name: string }[]; header: Header; qrUrl?: (studentId: string) => string }): Promise<Uint8Array> {
  const d = await Doc.create();
  const list = opts.students.length ? opts.students : [{ id: "modelo", name: "" }];
  for (let si = 0; si < list.length; si++) {
    if (si > 0) d.newPage();
    const s = list[si];
    d.text(opts.header.schoolName || "Escola", { font: d.f.sansBold, size: 13 });
    d.text(`Cartão-resposta — ${opts.appTitle}`, { font: d.f.serifBold, size: 14 });
    d.text(`${opts.versionLabel} · Código: ${opts.code}-${s.id.slice(0, 6).toUpperCase()}`, { size: 9, color: [0.3, 0.3, 0.3] });
    d.text(`Aluno(a): ${s.name || "______________________________________"}`, { size: 11 });
    d.gap(6);
    // QR do cartão: o professor escaneia e a nota segue para a escola
    if (opts.qrUrl && s.id !== "modelo") {
      const qr = QRCode.create(opts.qrUrl(s.id), { errorCorrectionLevel: "M" });
      const n = qr.modules.size; const cell = 3; const ox = A4.w - M.r - n * cell - 4; const oy = A4.h - M.t - n * cell - 4;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(r, c)) d.page.drawRectangle({ x: ox + c * cell, y: oy + (n - 1 - r) * cell, width: cell, height: cell, color: rgb(0, 0, 0) });
      d.page.drawText("Escaneie para enviar a nota", { x: ox - 4, y: oy - 9, size: 6.5, font: d.f.sans, color: rgb(0.3, 0.3, 0.3) });
    }
    // marcadores fiduciais nos cantos
    const fid = (x: number, y: number) => d.page.drawRectangle({ x, y, width: 14, height: 14, color: rgb(0, 0, 0) });
    fid(28, 28); fid(A4.w - 42, 28); fid(28, A4.h - 42); fid(A4.w - 42, A4.h - 42);
    const cols = opts.itemCount > 20 ? 2 : 1; const per = Math.ceil(opts.itemCount / cols); const rowH = 26;
    const top = d.y - 6;
    d.page.drawText("Marque com caneta preta, preenchendo totalmente o círculo.", { x: M.l, y: top, size: 9, font: d.f.sans, color: rgb(0.3, 0.3, 0.3) });
    for (let i = 0; i < opts.itemCount; i++) {
      const c = Math.floor(i / per); const r = i % per;
      const x0 = M.l + c * 250; const y0 = top - 30 - r * rowH;
      d.page.drawText(String(i + 1).padStart(2, "0"), { x: x0, y: y0 - 4, size: 11, font: d.f.sansBold });
      ["A", "B", "C", "D", "E"].forEach((L, k) => {
        const cx = x0 + 34 + k * 36;
        d.page.drawCircle({ x: cx, y: y0, size: 8, borderWidth: 1, borderColor: rgb(0, 0, 0) });
        d.page.drawText(L, { x: cx - 3.2, y: y0 - 3.4, size: 8, font: d.f.sans });
      });
    }
  }
  d.footer(`${opts.versionLabel} · ${opts.code}`);
  return d.doc.save();
}

export async function renderGradesSummary(opts: { title: string; school: string; period: string; items: { title: string; weight: number }[]; rows: { name: string; cells: string[]; average: string; partial: boolean }[] }): Promise<Uint8Array> {
  const d = await Doc.create();
  d.text(opts.school, { font: d.f.sansBold, size: 13 });
  d.text(`${opts.title} — ${opts.period}`, { font: d.f.serifBold, size: 14 });
  d.gap(6);
  const colW = Math.min(70, (d.width - 170) / Math.max(1, opts.items.length + 1));
  const drawRow = (cells: string[], bold = false) => {
    d.need(16);
    let x = M.l;
    const widths = [170, ...opts.items.map(() => colW), colW];
    cells.forEach((c, i) => { d.page.drawText(clean(c, d.f.sans).slice(0, i === 0 ? 34 : 12), { x, y: d.y - 10, size: 9, font: bold ? d.f.sansBold : d.f.sans }); x += widths[i]; });
    d.y -= 15;
  };
  drawRow(["Aluno", ...opts.items.map((i) => i.title), "Média"], true);
  d.rule();
  for (const r of opts.rows) drawRow([r.name, ...r.cells, r.average + (r.partial ? "*" : "")]);
  d.gap(8);
  d.text("* média parcial: há lançamentos pendentes ou não computados. A equipe escolar é responsável pelos registros oficiais.", { size: 8, color: [0.35, 0.35, 0.35] });
  d.footer("Questeca · resumo de notas");
  return d.doc.save();
}

export type ReportCardOpts = {
  school: string; student: string; period: string; issuedOn: string;
  disciplines: { subject: string; className: string; items: { title: string; label: string; max: string; weight: string }[]; average: string; partial: boolean; formula: string; attendance: string; notes: string[] }[];
};
/** Boletim individual: notas com origem, média com fórmula, frequência e observações autorizadas para a família. Zero, falta e pendente aparecem distintos. */
export async function renderReportCard(o: ReportCardOpts): Promise<Uint8Array> {
  const d = await Doc.create();
  d.text(o.school, { font: d.f.sansBold, size: 13 });
  d.text(`Boletim — ${o.period}`, { font: d.f.serifBold, size: 16 });
  d.text(`Estudante: ${o.student}`, { size: 11 });
  d.text(`Emitido em ${o.issuedOn}`, { size: 9, color: [0.35, 0.35, 0.35] });
  d.gap(6);
  for (const x of o.disciplines) {
    d.need(70);
    d.rule();
    d.text(`${x.subject} · ${x.className}`, { font: d.f.sansBold, size: 11 });
    if (x.items.length === 0) d.text("Sem avaliações lançadas neste período.", { size: 9.5, color: [0.35, 0.35, 0.35] });
    for (const it of x.items) d.text(`${it.title}: ${it.label} (máx. ${it.max}, peso ${it.weight})`, { size: 9.5, x: M.l + 10, maxW: d.width - 10 });
    d.text(`Média do período: ${x.average}${x.partial ? " (parcial)" : ""}`, { font: d.f.sansBold, size: 10 });
    if (x.items.length) d.text(`Cálculo: ${x.formula}`, { size: 8.5, color: [0.3, 0.3, 0.3], maxW: d.width });
    d.text(`Frequência: ${x.attendance}`, { size: 9.5 });
    for (const n of x.notes) d.text(`Observação: ${n}`, { size: 9, x: M.l + 10, maxW: d.width - 10, color: [0.2, 0.2, 0.2] });
    d.gap(4);
  }
  d.gap(6);
  d.text("Legenda: F = ausência na avaliação · N = não entregue · pendente = ainda sem nota. Zero, falta e pendente não se confundem. A escola é responsável pelos registros oficiais.", { size: 8, color: [0.35, 0.35, 0.35] });
  d.footer(`${o.school} · boletim de ${o.student}`);
  return d.doc.save();
}
