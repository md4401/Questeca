import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { tasks, taskSubmissions, quizzes, quizAttempts, attendanceRecords, attendanceSessions, type OrgSettings } from "@/db/schema";
import { classStudents } from "@/lib/access";
import { loadGradebook, rulesFrom } from "@/lib/gradebook";
import { summarize } from "@/lib/core/attendance";
import { riskOf, thresholdsFrom, mean } from "@/lib/core/analytics";
import { anyOf } from "@/lib/portal";

/** Painel da turma: média, frequência, tarefas, quizzes e sinais de atenção por aluno, mais a evolução por período. */
export async function classAnalytics(classId: string, settings: OrgSettings, period: string) {
  const rules = rulesFrom(settings);
  const th = thresholdsFrom(settings.risk, rules.passMark);
  const roster = await classStudents(classId);
  const ids = roster.map((s) => s.id);
  const gb = await loadGradebook(classId, period, rules);
  const recs = ids.length ? await db.select({ s: attendanceRecords.studentId, status: attendanceRecords.status }).from(attendanceRecords).innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId)).where(and(eq(attendanceSessions.classId, classId), inArray(attendanceRecords.studentId, anyOf(ids)))) : [];
  const ts = await db.select().from(tasks).where(and(eq(tasks.classId, classId), ne(tasks.status, "draft")));
  const subs = ts.length ? await db.select().from(taskSubmissions).where(inArray(taskSubmissions.taskId, ts.map((t) => t.id))) : [];
  const qs = await db.select().from(quizzes).where(and(eq(quizzes.classId, classId), ne(quizzes.status, "draft")));
  const att = qs.length ? await db.select().from(quizAttempts).where(and(inArray(quizAttempts.quizId, qs.map((q) => q.id)), eq(quizAttempts.status, "submitted"))) : [];
  const now = new Date();
  const rows = roster.map((s, i) => {
    const comp = gb.rows[i]?.computed;
    const a = summarize(recs.filter((r) => r.s === s.id));
    const mine = subs.filter((x) => x.studentId === s.id && x.status !== "draft");
    const late = ts.filter((t) => t.dueAt && t.dueAt < now && !subs.some((x) => x.taskId === t.id && x.studentId === s.id && x.status !== "draft")).length;
    const qpct = mean(att.filter((x) => x.studentId === s.id).map((x) => (Number(x.maxScore) > 0 ? (Number(x.score) / Number(x.maxScore)) * 100 : 0)));
    const average = comp?.average ?? null;
    return { student: s, average, partial: !!comp?.partial, formula: comp?.formula ?? "", attendance: a, delivered: mine.length, taskTotal: ts.length, late, quizPct: qpct, risk: riskOf({ average, averagePartial: !!comp?.partial, attendancePct: a.pct, lateTasks: late }, th) };
  });
  const evolution = [];
  for (const p of rules.periods) { const g = p === period ? gb : await loadGradebook(classId, p, rules); evolution.push({ period: p, avg: mean(g.rows.map((r) => r.computed.average).filter((v): v is number => v != null)), n: g.rows.filter((r) => r.computed.average != null).length }); }
  return { rows, rules, th, evolution, items: gb.items.length };
}
