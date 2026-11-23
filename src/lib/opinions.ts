import "server-only";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, attendanceSessions, gradeItems, grades, observations } from "@/db/schema";
import { classStudents } from "@/lib/access";
import type { Ctx } from "@/lib/session";

export const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const periodLabel = (p: string) => `${MONTHS[Number(p.slice(5, 7)) - 1]} de ${p.slice(0, 4)}`;
export const validPeriod = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
const nextMonth = (p: string) => { const y = Number(p.slice(0, 4)), m = Number(p.slice(5, 7)); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`; };

/** Registros do mês por aluno: marcações rápidas, anotações, frequência e média das notas lançadas no período. */
export async function gatherOpinionData(ctx: Ctx, classId: string, period: string) {
  const from = `${period}-01`; const to = nextMonth(period);
  const roster = await classStudents(classId);
  const [obs, sess, items] = await Promise.all([
    db.select().from(observations).where(and(eq(observations.classId, classId), gte(observations.observedOn, from), lt(observations.observedOn, to))),
    db.select().from(attendanceSessions).where(and(eq(attendanceSessions.classId, classId), gte(attendanceSessions.date, from), lt(attendanceSessions.date, to))),
    db.select().from(gradeItems).where(and(eq(gradeItems.classId, classId), gte(gradeItems.createdAt, new Date(`${from}T00:00:00-03:00`)), lt(gradeItems.createdAt, new Date(`${to}T00:00:00-03:00`)))),
  ]);
  const [recs, gr] = await Promise.all([
    sess.length ? db.select().from(attendanceRecords).where(inArray(attendanceRecords.sessionId, sess.map((s) => s.id))) : Promise.resolve([]),
    items.length ? db.select().from(grades).where(inArray(grades.gradeItemId, items.map((i) => i.id))) : Promise.resolve([]),
  ]);
  const manager = ctx.org.role === "coordinator";
  const visible = obs.filter((o) => o.authorId === ctx.user.id || o.visibility !== "private" || manager);
  return roster.map((s) => {
    const mine = visible.filter((o) => o.studentId === s.id);
    const r = recs.filter((x) => x.studentId === s.id && x.status !== "justified");
    const scores = gr.filter((g) => g.studentId === s.id && (g.state === "value" || g.state === "zero") && g.value != null).map((g) => (Number(g.value) / (Number(items.find((i) => i.id === g.gradeItemId)?.maxPoints) || 10)) * 10);
    return {
      student: s, tags: mine.flatMap((o) => o.tags), notes: mine.map((o) => o.text).filter(Boolean), observations: mine.length,
      attendancePct: r.length ? Math.round((r.filter((x) => x.status === "present").length / r.length) * 1000) / 10 : null,
      average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    };
  });
}
