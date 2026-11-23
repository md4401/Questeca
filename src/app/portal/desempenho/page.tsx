import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { tasks, taskSubmissions, attendanceRecords, attendanceSessions } from "@/db/schema";
import { requirePortal, anyOf } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";
import { rulesFrom, studentGrades } from "@/lib/gradebook";
import { summarize } from "@/lib/core/attendance";
import { subjectLabel } from "@/lib/taxonomy";
import { fmtNum } from "@/lib/format";

export const metadata = { title: "Desempenho" };
export default async function Desempenho({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const sp = await searchParams; const p = await requirePortal(sp.aluno);
  const rules = rulesFrom(p.ctx.org.settings);
  const ts = await db.select().from(tasks).where(and(inArray(tasks.classId, anyOf(p.classIds)), ne(tasks.status, "draft")));
  const subs = ts.length ? await db.select().from(taskSubmissions).where(and(inArray(taskSubmissions.taskId, ts.map((t) => t.id)), eq(taskSubmissions.studentId, p.student.id))) : [];
  const data = await Promise.all(p.classes.map(async (c) => {
    const evo = await Promise.all(rules.periods.map(async (per) => ({ per, g: await studentGrades(c.id, p.student.id, per, rules) })));
    const recs = await db.select({ status: attendanceRecords.status }).from(attendanceRecords).innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId)).where(and(eq(attendanceRecords.studentId, p.student.id), eq(attendanceSessions.classId, c.id)));
    const tk = ts.filter((t) => t.classId === c.id);
    return { c, evo, att: summarize(recs), tk: tk.length, done: tk.filter((t) => subs.some((s) => s.taskId === t.id && s.status !== "draft")).length };
  }));
  return (
    <div className="space-y-6"><StudentSwitch list={p.students} active={p.student.id} base="/portal/desempenho" /><h1>Desempenho</h1>
      <p className="hint">Um retrato do período, com a origem de cada número. Não é um diagnóstico nem decide aprovação.</p>
      {data.map(({ c, evo, att, tk, done }) => (
        <section key={c.id} className="card"><h2 className="text-lg">{c.name} · {subjectLabel(c.subject)}</h2>
          <ul className="mt-2 space-y-1 text-sm" aria-label="Média por período">{evo.map(({ per, g }) => <li key={per} className="flex items-center gap-2"><span className="w-28 shrink-0">{per}</span><span className="h-3 rounded bg-brand" style={{ width: `${((g.computed.average ?? 0) / rules.scaleMax) * 100}%`, minWidth: g.computed.average ? 6 : 0 }} /><span>{g.computed.average == null ? "—" : fmtNum(g.computed.average)}{g.computed.partial && <span className="hint"> parcial</span>}</span></li>)}</ul>
          <p className="mt-3 text-sm">Frequência: <strong>{att.pct == null ? "sem chamadas" : `${String(att.pct).replace(".", ",")}%`}</strong> · Tarefas entregues: <strong>{done}/{tk}</strong></p></section>))}
    </div>
  );
}
