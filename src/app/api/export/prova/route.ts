import { NextResponse } from "next/server";
import { getStaffCtx as getCtx } from "@/lib/session";
import { loadAssessment } from "@/lib/access";
import { renderExam } from "@/lib/pdf";
import { renderDocx } from "@/lib/docx";
import { snapshotFor, ownerName, pdfResponse, slug } from "@/lib/export-helpers";
import { planInfo } from "@/lib/billing";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { track } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  const u = new URL(req.url);
  const id = u.searchParams.get("id") ?? "";
  const tipo = u.searchParams.get("tipo") === "professor" ? "teacher" : "student";
  const fmt = u.searchParams.get("formato") === "docx" ? "docx" : "pdf";
  let a;
  try { a = await loadAssessment(ctx, id); } catch { return new NextResponse("Não encontrado", { status: 404 }); }
  if (fmt === "docx") {
    const info = await planInfo(ctx.org.id);
    if (!info.features.word) return new NextResponse("Word editável está disponível nos planos Professor e Escola.", { status: 403 });
  }
  const { snap, label } = await snapshotFor(ctx, a, { versionId: u.searchParams.get("versao") ?? undefined, draft: u.searchParams.get("rascunho") === "1" });
  const [cls] = a.classId ? await db.select().from(classes).where(eq(classes.id, a.classId)).limit(1) : [];
  const teacher = await ownerName(a.ownerId);
  await track("export", ctx.user.id, ctx.org.id, { fmt, tipo, assessmentId: id });
  if (fmt === "docx") {
    const buf = await renderDocx(snap, { mode: tipo, teacher, className: cls?.name, versionLabel: label });
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${slug(a.title)}-${tipo === "teacher" ? "professor" : "aluno"}.docx"` } });
  }
  const { bytes, warnings } = await renderExam(snap, { mode: tipo, teacher, className: cls?.name, bigFont: u.searchParams.get("fonte") === "grande", versionLabel: label });
  const res = pdfResponse(bytes, `${slug(a.title)}-${tipo === "teacher" ? "gabarito-professor" : "aluno"}.pdf`, u.searchParams.get("inline") === "1");
  res.headers.set("X-Questeca-Warnings", encodeURIComponent(warnings.join("|")));
  return res;
}
