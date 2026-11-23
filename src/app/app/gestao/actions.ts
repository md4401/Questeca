"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { students, classes, enrollments, enrollmentHistory, accessInvites, classTeachers } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/form";

async function manager() {
  const ctx = await requireCtx();
  if (ctx.org.role !== "coordinator" && ctx.org.role !== "admin") throw new Error("forbidden");
  return ctx;
}

export async function updateStudentAction(studentId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await manager();
  const p = z.object({ name: z.string().trim().min(2, "Informe o nome.").max(160), registration: z.string().trim().max(60).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const r = await db.update(students).set({ name: p.data.name, registration: p.data.registration || null }).where(and(eq(students.id, studentId), eq(students.orgId, ctx.org.id))).returning({ id: students.id });
  if (!r.length) return { error: "Aluno não encontrado." };
  await audit(ctx.user.id, ctx.org.id, "student.updated", studentId);
  revalidatePath("/app/gestao");
  return { ok: "Cadastro atualizado." };
}

/** Transferência entre turmas da escola com histórico (quem, quando, por quê). Notas e frequência da turma antiga permanecem nela. */
export async function transferStudentAction(studentId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await manager();
  const p = z.object({ fromClassId: z.string().uuid("Escolha a turma de origem."), toClassId: z.string().uuid("Escolha a turma de destino."), reason: z.string().trim().max(300).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.fromClassId === p.data.toClassId) return { error: "A turma de destino deve ser diferente da origem." };
  const [from] = await db.select().from(classes).where(and(eq(classes.id, p.data.fromClassId), eq(classes.orgId, ctx.org.id))).limit(1);
  const [to] = await db.select().from(classes).where(and(eq(classes.id, p.data.toClassId), eq(classes.orgId, ctx.org.id))).limit(1);
  const [st] = await db.select().from(students).where(and(eq(students.id, studentId), eq(students.orgId, ctx.org.id))).limit(1);
  if (!from || !to || !st) return { error: "Turma ou aluno não encontrado nesta escola." };
  const [en] = await db.select().from(enrollments).where(and(eq(enrollments.classId, from.id), eq(enrollments.studentId, st.id), eq(enrollments.status, "active"))).limit(1);
  if (!en) return { error: "O aluno não está ativo na turma de origem." };
  await db.update(enrollments).set({ status: "transferred" }).where(and(eq(enrollments.classId, from.id), eq(enrollments.studentId, st.id)));
  await db.insert(enrollments).values({ classId: to.id, studentId: st.id, status: "active" }).onConflictDoUpdate({ target: [enrollments.classId, enrollments.studentId], set: { status: "active" } });
  await db.insert(enrollmentHistory).values({ orgId: ctx.org.id, studentId: st.id, fromClassId: from.id, toClassId: to.id, reason: p.data.reason || null, actorId: ctx.user.id });
  await audit(ctx.user.id, ctx.org.id, "student.transferred", st.id, { from: from.id, to: to.id });
  revalidatePath("/app/gestao");
  return { ok: `${st.name} agora está em ${to.name}.` };
}

export async function revokeAccessInviteAction(id: string) {
  const ctx = await manager();
  await db.update(accessInvites).set({ revokedAt: new Date() }).where(and(eq(accessInvites.id, id), eq(accessInvites.orgId, ctx.org.id)));
  await audit(ctx.user.id, ctx.org.id, "access.invite_revoked", id);
  revalidatePath("/app/gestao");
}

/** Cria as turmas do próximo ano letivo (sem alunos), mantendo nome, série e disciplina, e atribuindo os mesmos professores. */
export async function rolloverClassAction(classId: string) {
  const ctx = await manager();
  const [c] = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.orgId, ctx.org.id))).limit(1);
  if (!c) return;
  const [ex] = await db.select().from(classes).where(and(eq(classes.orgId, ctx.org.id), eq(classes.name, c.name), eq(classes.grade, c.grade), eq(classes.subject, c.subject), eq(classes.year, c.year + 1))).limit(1);
  if (ex) return;
  const [n] = await db.insert(classes).values({ orgId: c.orgId, name: c.name, grade: c.grade, subject: c.subject, year: c.year + 1, createdBy: ctx.user.id }).returning();
  const teachers = await db.select({ u: classTeachers.userId }).from(classTeachers).where(eq(classTeachers.classId, c.id));
  if (teachers.length) await db.insert(classTeachers).values(teachers.map((t) => ({ classId: n.id, userId: t.u })));
  await audit(ctx.user.id, ctx.org.id, "class.rollover", n.id);
  revalidatePath("/app/gestao");
}
