import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { reportCards, enrollments, classTeachers } from "@/db/schema";
import { getStaffCtx as getCtx } from "@/lib/session";
import { canAccessClass } from "@/lib/core/permissions";

export const dynamic = "force-dynamic";
const NF = () => new NextResponse("Não encontrado", { status: 404 });

/** Boletim emitido: quem tem acesso a alguma turma do estudante. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NF();
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Entre para continuar", { status: 401 });
  const [rc] = await db.select().from(reportCards).where(eq(reportCards.id, id)).limit(1);
  if (!rc || rc.orgId !== ctx.org.id) return NF();
  const cls = await db.select({ classId: enrollments.classId }).from(enrollments).where(and(eq(enrollments.studentId, rc.studentId), eq(enrollments.status, "active")));
  let ok = false;
  for (const c of cls) {
    const t = await db.select({ u: classTeachers.userId }).from(classTeachers).where(eq(classTeachers.classId, c.classId));
    if (canAccessClass({ role: ctx.org.role, orgId: ctx.org.id, userId: ctx.user.id }, { orgId: rc.orgId, teacherIds: t.map((x) => x.u) })) { ok = true; break; }
  }
  if (!ok) return NF();
  return new NextResponse(new Uint8Array(rc.pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="boletim-${encodeURIComponent(rc.period)}.pdf"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
