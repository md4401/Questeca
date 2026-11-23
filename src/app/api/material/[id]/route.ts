import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { materials } from "@/db/schema";
import { getCtx } from "@/lib/session";
import { visibleStudents } from "@/lib/portal";
import { enrollments } from "@/db/schema";
import { and, inArray } from "drizzle-orm";

export const runtime = "nodejs";

/** Arquivo de material. Dono; colegas da escola (compartilhado e aprovado); alunos e responsáveis da turma (compartilhado com a turma e aprovado). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const [m] = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
  if (!m?.file || m.orgId !== ctx.org.id) return new NextResponse("Não encontrado", { status: 404 });
  const portal = ctx.org.role === "student" || ctx.org.role === "guardian";
  let ok = false;
  if (!portal) ok = m.ownerId === ctx.user.id || (m.visibility === "school" && m.approval === "approved");
  else if (m.visibility === "class" && m.approval === "approved" && m.classId) {
    const sids = (await visibleStudents(ctx)).map((s) => s.id);
    if (sids.length) { const e = await db.select().from(enrollments).where(and(eq(enrollments.classId, m.classId), inArray(enrollments.studentId, sids), eq(enrollments.status, "active"))).limit(1); ok = !!e[0]; }
  }
  if (!ok) return new NextResponse("Não encontrado", { status: 404 });
  await db.update(materials).set({ downloads: sql`${materials.downloads} + 1` }).where(eq(materials.id, id));
  return new Response(new Uint8Array(m.file), { headers: { "Content-Type": m.fileType ?? "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(m.fileName ?? "material")}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
