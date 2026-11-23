import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, classTeachers, assessments, applications, students, enrollments } from "@/db/schema";
import { canAccessClass, type Role } from "@/lib/core/permissions";
import type { Ctx } from "@/lib/session";
import { notFound } from "next/navigation";

/**
 * Autorização por recurso. Toda leitura/escrita de turma, avaliação, aplicação ou aluno passa por aqui:
 * isola escolas, turmas e espaço pessoal mesmo com link direto (PRD cap. 29).
 */
export async function loadClass(ctx: Ctx, classId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(classId)) notFound();
  const [cls] = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  if (!cls) notFound();
  const mem = ctx.orgs.find((o) => o.id === cls.orgId);
  const teachers = await db.select({ userId: classTeachers.userId }).from(classTeachers).where(eq(classTeachers.classId, cls.id));
  const ok = canAccessClass(mem ? { role: mem.role, orgId: mem.id, userId: ctx.user.id } : null, { orgId: cls.orgId, teacherIds: teachers.map((t) => t.userId) });
  if (!ok) notFound();
  return { cls, role: mem!.role as Role };
}

export async function loadAssessment(ctx: Ctx, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [a] = await db.select().from(assessments).where(eq(assessments.id, id)).limit(1);
  if (!a) notFound();
  const mem = ctx.orgs.find((o) => o.id === a.orgId);
  if (!mem) notFound();
  if (a.classId) {
    await loadClass(ctx, a.classId);
  } else if (a.ownerId !== ctx.user.id) notFound();
  return a;
}

export async function loadApplication(ctx: Ctx, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [app] = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
  if (!app) notFound();
  const { cls } = await loadClass(ctx, app.classId);
  return { app, cls };
}

export async function classStudents(classId: string) {
  return db
    .select({ id: students.id, name: students.name, registration: students.registration })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.classId, classId), eq(enrollments.status, "active")))
    .orderBy(students.name);
}

export async function visibleClasses(ctx: Ctx) {
  const rows = await db.select().from(classes).where(and(eq(classes.orgId, ctx.org.id), eq(classes.archived, false)));
  if (ctx.org.role === "coordinator") return rows;
  if (ctx.org.role === "admin") return [];
  const mine = await db.select({ classId: classTeachers.classId }).from(classTeachers).where(eq(classTeachers.userId, ctx.user.id));
  const set = new Set(mine.map((m) => m.classId));
  return rows.filter((r) => set.has(r.id));
}
