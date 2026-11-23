import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, enrollments, students, observations, attendanceRecords, attendanceSessions, type OrgSettings } from "@/db/schema";
import { rulesFrom, studentGrades, cellLabel } from "@/lib/gradebook";
import { summarize } from "@/lib/core/attendance";
import { renderReportCard } from "@/lib/pdf";
import { subjectLabel, gradeLabel } from "@/lib/taxonomy";
import { fmtDate, fmtNum, todayISO } from "@/lib/format";

/** Gera o PDF do boletim de um estudante para um período, juntando todas as turmas em que está matriculado. */
export async function buildReportCard(opts: { orgName: string; settings: OrgSettings; studentId: string; period: string }) {
  const rules = rulesFrom(opts.settings);
  const [st] = await db.select().from(students).where(eq(students.id, opts.studentId)).limit(1);
  if (!st) throw new Error("Estudante não encontrado");
  const cls = await db.select({ c: classes }).from(enrollments).innerJoin(classes, eq(classes.id, enrollments.classId)).where(and(eq(enrollments.studentId, st.id), eq(enrollments.status, "active"), eq(classes.archived, false)));
  const disciplines = [];
  for (const { c } of cls) {
    const g = await studentGrades(c.id, st.id, opts.period, rules);
    const recs = await db.select({ status: attendanceRecords.status }).from(attendanceRecords).innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId)).where(and(eq(attendanceRecords.studentId, st.id), eq(attendanceSessions.classId, c.id)));
    const a = summarize(recs);
    const obs = await db.select({ text: observations.text, on: observations.observedOn }).from(observations).where(and(eq(observations.classId, c.id), eq(observations.studentId, st.id), eq(observations.visibility, "family")));
    disciplines.push({
      subject: subjectLabel(c.subject), className: `${c.name} (${gradeLabel(c.grade)})`,
      items: g.items.map((it, i) => ({ title: it.title, label: cellLabel(g.cells[i]) || "pendente", max: fmtNum(it.maxPoints), weight: fmtNum(it.weight) })),
      average: g.computed.average == null ? "—" : fmtNum(g.computed.average), partial: g.computed.partial, formula: g.computed.formula,
      attendance: a.pct == null ? "sem chamadas registradas" : `${String(a.pct).replace(".", ",")}% (${a.present} presença(s), ${a.absent} falta(s), ${a.justified} justificada(s) em ${a.total} chamada(s))`,
      notes: obs.map((o) => `${o.text} (${fmtDate(o.on)})`),
    });
  }
  return renderReportCard({ school: opts.settings.header?.schoolName || opts.orgName, student: st.name, period: opts.period, issuedOn: fmtDate(todayISO()), disciplines });
}
