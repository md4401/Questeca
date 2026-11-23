import Link from "next/link";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { tasks, taskSubmissions } from "@/db/schema";
import { requirePortal, anyOf } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";
import { studentStatus, TASK_STATUS_LABEL, type StudentTaskStatus } from "@/lib/core/tasks";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Tarefas" };

export default async function PortalTarefas({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const sp = await searchParams;
  const p = await requirePortal(sp.aluno);
  const list = await db.select().from(tasks).where(and(inArray(tasks.classId, anyOf(p.classIds)), ne(tasks.status, "draft"))).orderBy(tasks.dueAt);
  const subs = list.length ? await db.select().from(taskSubmissions).where(and(inArray(taskSubmissions.taskId, list.map((t) => t.id)), eq(taskSubmissions.studentId, p.student.id))) : [];
  const now = new Date();
  const rows = list.map((t) => { const s = subs.find((x) => x.taskId === t.id); return { t, st: studentStatus(t, s ? { status: s.status, submittedAt: s.submittedAt, grade: s.grade } : null, now) as StudentTaskStatus }; });
  const groups: [string, StudentTaskStatus[]][] = [["Para fazer", ["pendente", "rascunho", "atrasada"]], ["Entregues", ["entregue", "entregue_atrasada"]], ["Corrigidas", ["corrigida"]]];
  const q = p.students.length > 1 ? `?aluno=${p.student.id}` : "";
  return (
    <div className="space-y-6">
      <StudentSwitch list={p.students} active={p.student.id} base="/portal/tarefas" />
      <h1>Tarefas</h1>
      {groups.map(([title, sts]) => {
        const g = rows.filter((r) => sts.includes(r.st));
        return (
          <section key={title} className="card"><h2 className="mb-2 text-lg">{title} ({g.length})</h2>
            {g.length === 0 ? <p className="text-sm text-ink-soft">Nada aqui.</p> : <ul className="divide-y divide-line">{g.map(({ t, st }) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><div><Link href={`/portal/tarefas/${t.id}${q}`} className="font-semibold">{t.title}</Link><p className="hint">{t.dueAt ? `prazo ${fmtDateTime(t.dueAt)}` : "sem prazo"}</p></div>
                <span className={`badge ${st === "atrasada" ? "badge-amber" : ""}`}>{TASK_STATUS_LABEL[st]}</span></li>))}</ul>}
          </section>);
      })}
    </div>
  );
}
