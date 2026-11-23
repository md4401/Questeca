import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { answerSheets, applications, attendanceRecords, attendanceSessions, enrollments, gradeItems, grades } from "@/db/schema";

/** Números rápidos por turma para o Início: alunos, média (0–10), frequência e pendências de conferência. */
export async function classSummaries(classIds: string[]) {
  if (!classIds.length) return { byClass: new Map<string, { students: number; avg: number | null; att: number | null }>(), pending: 0 };
  const [enr, items, sessions, sheets] = await Promise.all([
    db.select({ classId: enrollments.classId }).from(enrollments).where(and(inArray(enrollments.classId, classIds), eq(enrollments.status, "active"))),
    db.select({ id: gradeItems.id, classId: gradeItems.classId, max: gradeItems.maxPoints }).from(gradeItems).where(inArray(gradeItems.classId, classIds)),
    db.select({ id: attendanceSessions.id, classId: attendanceSessions.classId }).from(attendanceSessions).where(inArray(attendanceSessions.classId, classIds)),
    db.select({ n: answerSheets.id }).from(answerSheets).innerJoin(applications, eq(applications.id, answerSheets.applicationId)).where(and(inArray(applications.classId, classIds), eq(answerSheets.status, "pending_review"))),
  ]);
  const [gr, recs] = await Promise.all([
    items.length ? db.select({ itemId: grades.gradeItemId, v: grades.value, state: grades.state }).from(grades).where(inArray(grades.gradeItemId, items.map((i) => i.id))) : Promise.resolve([]),
    sessions.length ? db.select({ sid: attendanceRecords.sessionId, status: attendanceRecords.status }).from(attendanceRecords).where(inArray(attendanceRecords.sessionId, sessions.map((s) => s.id))) : Promise.resolve([]),
  ]);
  const itemClass = new Map(items.map((i) => [i.id, { c: i.classId, max: Number(i.max) || 10 }]));
  const sessClass = new Map(sessions.map((s) => [s.id, s.classId]));
  const byClass = new Map<string, { students: number; avg: number | null; att: number | null }>();
  for (const id of classIds) {
    const sc = gr.filter((g) => itemClass.get(g.itemId)?.c === id && (g.state === "value" || g.state === "zero") && g.v != null).map((g) => (Number(g.v) / itemClass.get(g.itemId)!.max) * 10);
    const rc = recs.filter((r) => sessClass.get(r.sid) === id && r.status !== "justified");
    byClass.set(id, { students: enr.filter((e) => e.classId === id).length, avg: sc.length ? Math.round((sc.reduce((a, b) => a + b, 0) / sc.length) * 10) / 10 : null, att: rc.length ? Math.round((rc.filter((r) => r.status === "present").length / rc.length) * 100) : null });
  }
  const pendingCells = gr.filter((g) => g.state === "pending").length;
  return { byClass, pending: pendingCells + sheets.length };
}
