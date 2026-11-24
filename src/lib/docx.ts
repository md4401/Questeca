import "server-only";
import { Document, Packer, Paragraph, TextRun, Footer, AlignmentType, PageNumber } from "docx";
import type { Snapshot } from "@/lib/assessments";
import { topicName } from "@/lib/taxonomy";
import { parseMarkup } from "@/lib/core/richtext";

export async function renderDocx(snap: Snapshot, o: { mode: "student" | "teacher"; teacher?: string; className?: string; versionLabel: string }): Promise<Buffer> {
  const h = (snap.header ?? {}) as { schoolName?: string; subtitle?: string; instructions?: string; footer?: string };
  const student = o.mode === "student";
  const p = (t: string, opts: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; indent?: number; italics?: boolean } = {}) =>
    new Paragraph({ alignment: opts.align, spacing: { after: opts.after ?? 100 }, indent: opts.indent ? { left: opts.indent } : undefined, children: [new TextRun({ text: t, bold: opts.bold, size: opts.size ?? 22, italics: opts.italics, font: "Calibri" })] });
  /** Marcação {b}{i}{u} → parágrafo do Word com negrito, itálico e sublinhado. */
  const rich = (mk: string, opts: { size?: number; after?: number; indent?: number; italics?: boolean } = {}) => {
    const lines = parseMarkup(mk);
    const runs: TextRun[] = [];
    lines.forEach((ln, li) => ln.forEach((r, ri) => runs.push(new TextRun({ text: r.t, bold: r.b, italics: r.i || opts.italics, underline: r.u ? {} : undefined, size: opts.size, break: li > 0 && ri === 0 ? 1 : undefined }))));
    return new Paragraph({ spacing: { after: opts.after ?? 100 }, indent: opts.indent ? { left: opts.indent } : undefined, children: runs });
  };
  const esc = (t: string) => t.replace(/\{/g, "{lb}");
  const blocksBefore = (pos: number | null) => (snap.blocks ?? []).filter((b) => b.beforePosition === pos);
  const kids: Paragraph[] = [
    p(h.schoolName || "Escola", { bold: true, size: 28 }),
    ...(h.subtitle ? [p(h.subtitle)] : []),
    p(`Professor(a): ${o.teacher ?? ""}    Turma: ${o.className ?? ""}    Disciplina: Matemática`),
    ...(student ? [p("Aluno(a): ______________________________    Data: ____/____/______    Nota: ______")] : []),
    p(student ? snap.title : `Gabarito — ${snap.title}`, { bold: true, size: 30, after: 160 }),
    ...(student && snap.instructionsRich ? [rich(snap.instructionsRich, { italics: true, size: 18, after: 200 })] : student && h.instructions ? [p(h.instructions, { italics: true, size: 18, after: 200 })] : []),
  ];
  snap.items.forEach((it, i) => {
    if (student) {
      for (const b of blocksBefore(it.position)) kids.push(rich(b.text, { after: 140 }));
      kids.push(rich(`${i + 1}. ${it.rich?.statement ?? esc(it.statement ?? "")}  (${Number(it.points).toLocaleString("pt-BR")} pt)`, { after: 60 }));
      (it.rich?.alternatives ?? it.alternatives).forEach((a) => kids.push(rich(`${a.key}) ${it.rich?.alternatives ? a.text : esc(a.text)}`, { indent: 360, after: 30 })));
      kids.push(p("", { after: 120 }));
    } else {
      kids.push(p(`${i + 1}. Resposta: ${it.answer} · ${Number(it.points).toLocaleString("pt-BR")} pt · ${it.institution === "Segunda Lousa" ? "Banco autoral Segunda Lousa" : `${it.institution} ${it.exam} ${it.year}`}`, { bold: true, after: 20 }));
      kids.push(p(`Conteúdos: ${it.assessed.map(topicName).join(", ")}. Dificuldade ${it.difficulty}/5 (estimada).`, { size: 18, indent: 240, after: 120 }));
    }
  });
  if (student) for (const b of blocksBefore(null)) kids.push(rich(b.text, { after: 140 }));
  const doc = new Document({
    creator: "Segunda Lousa", title: snap.title,
    sections: [{
      children: kids,
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${h.footer ? h.footer + " · " : ""}${o.versionLabel} · exportado da Segunda Lousa. Edições no Word exigem conferência do gabarito antes de importar resultados · Página `, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], size: 16 })] })] }) },
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
