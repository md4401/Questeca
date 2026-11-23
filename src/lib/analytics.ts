import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, attendanceSessions, type OrgSettings } from "@/db/schema";
import { classStudents } from "@/lib/access";
import { loadGradebook, rulesFrom } from "@/lib/gradebook";
import { summarize } from "@/lib/core/attendance";
import { riskOf, thresholdsFrom, mean } from "@/lib/core/analytics";
import { anyOf } from "@/lib/util";

/** Painel da turma: média, frequência, tarefas, quizzes e sinais de atenção por aluno, mais a evolução por período. */
export async function classAnalytics(classId: string, settings: OrgSettings, period: string) {
  const rules = rulesFrom(settings);
  const th = thresholdsFrom(settings.risk, rules.passMark);
  const roster = await classStudents(classId);
  const ids = roster.map((s) => s.id);
  const gb = await loadGradebook(classId, period, rules);
  const recs = ids.length ? await db.select({ s: attendanceRecords.studentId, status: attendanceRecords.status }).from(attendanceRecords).innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId)).where(and(eq(attendanceSessions.classId, classId), inArray(attendanceRecords.studentId, anyOf(ids)))) : [];
  const rows = roster.map((s, i) => {
    const comp = gb.rows[i]?.computed;
    const a = summarize(recs.filter((r) => r.s === s.id));
    const average = comp?.average ?? null;
    return { student: s, average, partial: !!comp?.partial, formula: comp?.formula ?? "", attendance: a, risk: riskOf({ average, averagePartial: !!comp?.partial, attendancePct: a.pct, lateTasks: 0 }, th) };
  });
  const evolution = [];
  for (const p of rules.periods) { const g = p === period ? gb : await loadGradebook(classId, p, rules); evolution.push({ period: p, avg: mean(g.rows.map((r) => r.computed.average).filter((v): v is number => v != null)), n: g.rows.filter((r) => r.computed.average != null).length }); }
  return { rows, rules, th, evolution, items: gb.items.length };
}
