import Link from "next/link";
import { eq, desc, count, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tasks, taskSubmissions } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { Form, SubmitButton } from "@/components/form";
import { TaskFields } from "@/components/task-form-fields";
import { createTaskAction } from "./actions";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Tarefas" };
const ST: Record<string, string> = { draft: "Rascunho", published: "Publicada", closed: "Encerrada" };

export default async function Tarefas({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const list = await db.select().from(tasks).where(eq(tasks.classId, id)).orderBy(desc(tasks.createdAt));
  const roster = await classStudents(id);
  const subs = list.length ? await db.select({ taskId: taskSubmissions.taskId, n: count() }).from(taskSubmissions).where(inArray(taskSubmissions.taskId, list.map((t) => t.id))).groupBy(taskSubmissions.taskId) : [];
  const sent = new Map(subs.map((s) => [s.taskId, Number(s.n)]));
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="card">
        <h2 className="mb-3 text-lg">Tarefas da turma</h2>
        {list.length === 0 ? <p className="text-ink-soft">Nenhuma tarefa ainda. Tarefas são separadas das provas formais: servem para atividades, trabalhos e formulários.</p> : (
          <ul className="divide-y divide-line">{list.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div><Link href={`/app/turmas/${id}/tarefas/${t.id}`} className="font-semibold">{t.title}</Link>
                <p className="hint">{ST[t.status]} · {t.dueAt ? `prazo ${fmtDateTime(t.dueAt)}` : "sem prazo"} · {sent.get(t.id) ?? 0}/{roster.length} entregas</p></div>
              <span className={`badge ${t.status === "published" ? "" : "badge-gray"}`}>{ST[t.status]}</span></li>))}</ul>)}
      </section>
      <section className="card"><h2 className="mb-2 text-lg">Nova tarefa</h2>
        <Form action={createTaskAction.bind(null, id)}><TaskFields /><SubmitButton pendingLabel="Criando…">Criar rascunho</SubmitButton></Form></section>
    </div>
  );
}
