import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { students, studentAccounts, guardianLinks, enrollments, classes } from "@/db/schema";
import { requireAnyCtx, type Ctx } from "@/lib/session";
import { isPortalRole } from "@/lib/core/permissions";

export type PortalStudent = { id: string; name: string; orgId: string };

/** Estudantes que esta conta pode ver: o próprio (aluno) ou os vinculados (responsável). Nunca outros. */
export async function visibleStudents(ctx: Ctx): Promise<PortalStudent[]> {
  if (ctx.org.role === "student") {
    return db.select({ id: students.id, name: students.name, orgId: students.orgId }).from(studentAccounts)
      .innerJoin(students, eq(students.id, studentAccounts.studentId))
      .where(and(eq(studentAccounts.userId, ctx.user.id), eq(studentAccounts.orgId, ctx.org.id)));
  }
  if (ctx.org.role === "guardian") {
    return db.select({ id: students.id, name: students.name, orgId: students.orgId }).from(guardianLinks)
      .innerJoin(students, eq(students.id, guardianLinks.studentId))
      .where(and(eq(guardianLinks.userId, ctx.user.id), eq(guardianLinks.orgId, ctx.org.id))).orderBy(students.name);
  }
  return [];
}

/** Contexto do portal: exige papel aluno/responsável e resolve o estudante ativo (?aluno=) entre os permitidos. */
export async function requirePortal(aluno?: string) {
  const ctx = await requireAnyCtx();
  if (!isPortalRole(ctx.org.role)) redirect("/app");
  const list = await visibleStudents(ctx);
  if (list.length === 0) notFound();
  const active = (aluno && list.find((s) => s.id === aluno)) || list[0];
  const classRows = await db.select({ id: classes.id, name: classes.name, subject: classes.subject, grade: classes.grade })
    .from(enrollments).innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(enrollments.studentId, active.id), eq(enrollments.status, "active"), eq(classes.archived, false)));
  return { ctx, students: list, student: active, classes: classRows, classIds: classRows.map((c) => c.id) };
}

export const studentQuery = (s: { id: string }, list: { id: string }[]) => (list.length > 1 ? `?aluno=${s.id}` : "");

/** Vazio seguro para inArray. */
export const anyOf = (ids: string[]) => (ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
export { inArray };
