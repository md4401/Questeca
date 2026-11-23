import { NextResponse } from "next/server";
import { getStaffCtx as getCtx } from "@/lib/session";
import { loadApplication, classStudents } from "@/lib/access";
import { applicationKey } from "@/lib/correction";
import { renderAnswerCards } from "@/lib/pdf";
import { pdfResponse, slug } from "@/lib/export-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  const id = new URL(req.url).searchParams.get("app") ?? "";
  let r;
  try { r = await loadApplication(ctx, id); } catch { return new NextResponse("Não encontrado", { status: 404 }); }
  const key = await applicationKey(r.app);
  const students = await classStudents(r.app.classId);
  const bytes = await renderAnswerCards({
    appTitle: r.app.title, versionLabel: `Versão ${key.versionNumber ?? "externa"}`, code: `${r.app.id.slice(0, 8).toUpperCase()}-V${key.versionNumber ?? 0}`,
    itemCount: key.items.length, students: students.map((s) => ({ id: s.id, name: s.name })), header: ctx.org.settings.header ?? {},
  });
  return pdfResponse(bytes, `cartoes-${slug(r.app.title)}.pdf`);
}
