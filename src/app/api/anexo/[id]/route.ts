import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { taskAttachments, tasks, taskSubmissions } from "@/db/schema";
import { getCtx } from "@/lib/session";
import { canAccessClass } from "@/lib/core/permissions";
import { visibleStudents } from "@/lib/portal";
import { enrollments, classTeachers } from "@/db/schema";
import { and } from "drizzle-orm";

export const dynamic = "force-dynamic";
const NF = () => new NextResponse("Não encontrado", { status: 404 });

/** Anexo de tarefa/entrega. Equipe da turma, o aluno dono e o responsável vinculado (só anexos de tarefa publicada e a entrega do próprio estudante). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NF();
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Entre para continuar", { status: 401 });
  const [a] = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id)).limit(1);
  if (!a || a.orgId !== ctx.org.id) return NF();
  let classId: string; let ownerStudent: string | null = null; let published = true;
  if (a.taskId) { const [t] = await db.select().from(tasks).where(eq(tasks.id, a.taskId)).limit(1); if (!t) return NF(); classId = t.classId; published = t.status !== "draft"; }
  else if (a.submissionId) { const [s] = await db.select().from(taskSubmissions).where(eq(taskSubmissions.id, a.submissionId)).limit(1); if (!s) return NF(); const [t] = await db.select().from(tasks).where(eq(tasks.id, s.taskId)).limit(1); if (!t) return NF(); classId = t.classId; ownerStudent = s.studentId; }
  else return NF();
  let ok = false;
  if (ctx.org.role === "student" || ctx.org.role === "guardian") {
    const mine = await visibleStudents(ctx);
    for (const st of mine) {
      const [e] = await db.select().from(enrollments).where(and(eq(enrollments.classId, classId), eq(enrollments.studentId, st.id), eq(enrollments.status, "active"))).limit(1);
      if (e && published && (ownerStudent === null || ownerStudent === st.id)) ok = true;
    }
  } else {
    const teachers = await db.select({ u: classTeachers.userId }).from(classTeachers).where(eq(classTeachers.classId, classId));
    ok = canAccessClass({ role: ctx.org.role, orgId: ctx.org.id, userId: ctx.user.id }, { orgId: a.orgId, teacherIds: teachers.map((t) => t.u) });
  }
  if (!ok) return NF();
  return new NextResponse(new Uint8Array(a.data), { headers: { "Content-Type": a.type, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(a.name)}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
