import "server-only";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from "docx";
import type { LessonPlanContent } from "@/db/schema";

const P = (text: string, o: { bold?: boolean; size?: number } = {}) => new Paragraph({ children: [new TextRun({ text, bold: o.bold, size: o.size ?? 22 })], spacing: { after: 80 } });
const H = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 } });
const bullets = (l: string[]) => l.map((t) => new Paragraph({ text: t, bullet: { level: 0 } }));

export async function renderPlanDocx(c: LessonPlanContent): Promise<Buffer> {
  const id = c.identificacao;
  const cell = (t: string, bold = false) => new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [P(t, { bold })] });
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: "Plano de Aula", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell(`Escola: ${id.escola}`), cell(`Turma: ${id.turma}`)] }),
          new TableRow({ children: [cell(`Disciplina: ${id.disciplina}`), cell(`Professor(a): ${id.professor}`)] }),
          new TableRow({ children: [cell(`Data: ${id.data}`), cell(`Duração: ${id.duracaoMin} minutos`)] }),
        ] }),
        H("Tema"), P(c.tema),
        H("Objetivos de aprendizagem"), ...bullets(c.objetivos),
        H("Habilidades"), ...bullets(c.habilidades),
        H("Recursos"), ...bullets(c.recursos),
        H("Desenvolvimento"),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
          new TableRow({ children: [cell("Momento", true), cell("Atividade", true)] }),
          ...c.momentos.map((m) => new TableRow({ children: [cell(`${m.titulo} (${m.minutos} min)`), cell(m.descricao)] })),
        ] }),
        H("Avaliação"), P(c.avaliacao),
        H("Adaptações e inclusão"), P(c.adaptacoes),
        H("Referências"), ...bullets(c.referencias),
        P(c.origem === "ia" ? "Rascunho gerado com apoio de IA e revisado pelo professor." : "Rascunho gerado por modelo e revisado pelo professor.", { size: 16 }),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}
