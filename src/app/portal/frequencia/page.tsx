import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendanceSessions, attendanceRecords } from "@/db/schema";
import { requirePortal, anyOf } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";
import { summarize, isLow, ATT_LABEL, DEFAULT_MIN_PCT } from "@/lib/core/attendance";
import { fmtDate } from "@/lib/format";
import { subjectLabel } from "@/lib/taxonomy";

export const metadata = { title: "Frequência" };

export default async function PortalFrequencia({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const sp = await searchParams;
  const p = await requirePortal(sp.aluno);
  const rows = await db.select({ date: attendanceSessions.date, lesson: attendanceSessions.lesson, classId: attendanceSessions.classId, status: attendanceRecords.status, note: attendanceRecords.note })
    .from(attendanceRecords).innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
    .where(and(eq(attendanceRecords.studentId, p.student.id), inArray(attendanceSessions.classId, anyOf(p.classIds)))).orderBy(desc(attendanceSessions.date));
  const misses = rows.filter((r) => r.status !== "present").slice(0, 30);
  return (
    <div className="space-y-6">
      <StudentSwitch list={p.students} active={p.student.id} base="/portal/frequencia" />
      <h1>Frequência</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {p.classes.map((c) => { const s = summarize(rows.filter((r) => r.classId === c.id)); const low = isLow(s.pct);
          return (
            <section key={c.id} className="card"><h2 className="text-lg">{c.name} · {subjectLabel(c.subject)}</h2>
              <p className={`display mt-1 text-3xl ${low ? "text-danger" : ""}`}>{s.pct == null ? "—" : `${String(s.pct).replace(".", ",")}%`}</p>
              <p className="hint">{s.present} presença(s), {s.absent} falta(s), {s.justified} justificada(s) em {s.total} chamada(s)</p>
              {low && <p className="mt-2 rounded bg-amber-tint p-2 text-sm text-amber" role="status">Frequência abaixo de {DEFAULT_MIN_PCT}%. Procure a escola.</p>}
            </section>); })}
      </div>
      <section className="card"><h2 className="mb-2 text-lg">Faltas recentes</h2>
        {misses.length === 0 ? <p className="text-sm text-ink-soft">Nenhuma falta registrada.</p> : <ul className="space-y-1 text-sm">{misses.map((m, i) => <li key={i}>{fmtDate(m.date)}{m.lesson ? ` · ${m.lesson}` : ""} — {ATT_LABEL[m.status as keyof typeof ATT_LABEL]}{m.note ? ` (${m.note})` : ""}</li>)}</ul>}
      </section>
    </div>
  );
}
