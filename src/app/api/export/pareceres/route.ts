import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { db } from "@/db";
import { descriptiveOpinions } from "@/db/schema";
import { getStaffCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { periodLabel, validPeriod } from "@/lib/opinions";
import { slug } from "@/lib/export-helpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await getStaffCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  const u = new URL(req.url); const id = u.searchParams.get("turma") ?? ""; const mes = u.searchParams.get("mes") ?? "";
  if (!validPeriod(mes)) return new NextResponse("Mês inválido", { status: 400 });
  let cls; try { ({ cls } = await loadClass(ctx, id)); } catch { return new NextResponse("Não encontrado", { status: 404 }); }
  const studs = await classStudents(id);
  const ops = new Map((await db.select().from(descriptiveOpinions).where(and(eq(descriptiveOpinions.classId, id), eq(descriptiveOpinions.period, mes)))).map((o) => [o.studentId, o]));
  const children = [new Paragraph({ text: `Pareceres descritivos — ${cls.name} — ${periodLabel(mes)}`, heading: HeadingLevel.TITLE })];
  for (const s of studs) {
    const o = ops.get(s.id); if (!o) continue;
    children.push(new Paragraph({ text: s.name, heading: HeadingLevel.HEADING_2, spacing: { before: 240 } }));
    children.push(new Paragraph({ children: [new TextRun({ text: o.text })] }));
    if (o.status !== "approved") children.push(new Paragraph({ children: [new TextRun({ text: "(rascunho — não aprovado)", italics: true, size: 16 })] }));
  }
  const buf = await Packer.toBuffer(new Document({ sections: [{ children }] }));
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "content-disposition": `attachment; filename="pareceres-${slug(cls.name)}-${mes}.docx"` } });
}
