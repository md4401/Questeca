import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskSubmissions, taskAttachments } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { classStudents } from "@/lib/access";
import { Form, SubmitButton } from "@/components/form";
import { TaskFields } from "@/components/task-form-fields";
import { loadTaskForStaff, toLocalSP } from "@/lib/task-access";
import { updateTaskAction, publishTaskAction, closeTaskAction, extendDueAction, uploadTaskFileAction, deleteAttachmentAction, gradeSubmissionAction, launchGradesAction } from "../actions";
import { fmtDateTime } from "@/lib/format";
import { rulesFrom } from "@/lib/gradebook";
import { studentStatus, TASK_STATUS_LABEL, autoScore } from "@/lib/core/tasks";
import Link from "next/link";

export const metadata = { title: "Tarefa" };

export default async function TarefaDetalhe({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params;
  const ctx = await requireCtx();
  const { task } = await loadTaskForStaff(ctx, id, taskId);
  const roster = await classStudents(id);
  const subs = await db.select().from(taskSubmissions).where(eq(taskSubmissions.taskId, task.id));
  const files = await db.select({ id: taskAttachments.id, name: taskAttachments.name }).from(taskAttachments).where(and(eq(taskAttachments.taskId, task.id)));
  const rules = rulesFrom(ctx.org.settings);
  const now = new Date();
  return (
    <div className="space-y-6">
      <p className="hint"><Link href={`/app/turmas/${id}/tarefas`}>Tarefas</Link> › {task.title}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">{task.title} <span className="badge align-middle">{{ draft: "Rascunho", published: "Publicada", closed: "Encerrada" }[task.status]}</span></h2>
        <div className="flex flex-wrap gap-2">
          {task.status === "draft" && <form action={publishTaskAction.bind(null, id, task.id)}><button className="btn" type="submit">Publicar para a turma</button></form>}
          {task.status === "published" && <form action={closeTaskAction.bind(null, id, task.id)}><button className="btn btn-ghost" type="submit">Encerrar tarefa</button></form>}
        </div>
      </div>
      {task.status === "draft" ? (
        <section className="card"><h3 className="mb-2 text-lg">Editar rascunho</h3>
          <Form action={updateTaskAction.bind(null, id, task.id)}><TaskFields t={task} /><SubmitButton>Salvar rascunho</SubmitButton></Form></section>
      ) : (
        <section className="card text-sm"><p>{task.description || "Sem orientações."}</p>
          <p className="hint mt-2">Prazo: {task.dueAt ? fmtDateTime(task.dueAt) : "sem prazo"} · {String(Number(task.points)).replace(".", ",")} pontos · {task.allowLate ? "aceita atraso" : "não aceita atraso"} · {task.allowResubmit ? "permite reenvio" : "entrega única"}</p>
          <Form action={extendDueAction.bind(null, id, task.id)}><div className="mt-3 flex flex-wrap items-end gap-2"><div className="field !mb-0"><label htmlFor="dueAt2">Novo prazo</label><input id="dueAt2" name="dueAt" type="datetime-local" className="input" defaultValue={toLocalSP(task.dueAt)} /></div><SubmitButton className="btn btn-ghost">Atualizar prazo</SubmitButton></div></Form></section>)}
      <section className="card"><h3 className="mb-2 text-lg">Anexos</h3>
        {files.length === 0 ? <p className="text-sm text-ink-soft">Sem anexos.</p> : <ul className="mb-3 space-y-1 text-sm">{files.map((f) => <li key={f.id} className="flex items-center justify-between gap-2"><a href={`/api/anexo/${f.id}`}>{f.name}</a><form action={deleteAttachmentAction.bind(null, id, task.id, f.id)}><button className="link-btn text-danger" type="submit">Remover</button></form></li>)}</ul>}
        <Form action={uploadTaskFileAction.bind(null, id, task.id)}><div className="field"><label htmlFor="file">Anexar arquivo (até 4 MB)</label><input id="file" name="file" type="file" className="input" /></div><SubmitButton className="btn btn-ghost">Anexar</SubmitButton></Form></section>
      {task.status !== "draft" && (
        <section className="card">
          <h3 className="mb-2 text-lg">Entregas ({subs.filter((s) => s.status !== "draft").length}/{roster.length})</h3>
          <table className="t"><thead><tr><th>Aluno</th><th>Situação</th><th>Entrega</th><th>Correção</th></tr></thead><tbody>
            {roster.map((st) => {
              const sub = subs.find((x) => x.studentId === st.id);
              const stat = studentStatus(task, sub ? { status: sub.status, submittedAt: sub.submittedAt, grade: sub.grade } : null, now);
              const sc = sub && task.questions.length ? autoScore(task.questions, sub.answers) : null;
              return (
                <tr key={st.id}><td>{st.name}</td><td>{TASK_STATUS_LABEL[stat]}</td>
                  <td className="text-sm">{sub?.submittedAt ? fmtDateTime(sub.submittedAt) : "—"}{sub?.answerText && <p className="mt-1 max-w-xs whitespace-pre-line text-ink-soft">{sub.answerText}</p>}{sc && <p className="hint">Auto: {String(sc.score).replace(".", ",")}/{String(sc.auto).replace(".", ",")}{sc.needsReview ? " + discursivas" : ""}</p>}</td>
                  <td>{sub && sub.status !== "draft" ? (
                    <Form action={gradeSubmissionAction.bind(null, id, task.id, st.id)}>
                      <div className="flex flex-wrap items-center gap-1"><label className="sr-only" htmlFor={`g-${st.id}`}>Nota de {st.name}</label><input id={`g-${st.id}`} name="grade" className="input !w-20" inputMode="decimal" defaultValue={sub.grade != null ? String(Number(sub.grade)).replace(".", ",") : ""} placeholder={`/${String(Number(task.points)).replace(".", ",")}`} />
                        <label className="sr-only" htmlFor={`f-${st.id}`}>Devolutiva para {st.name}</label><input id={`f-${st.id}`} name="feedback" className="input !w-44" defaultValue={sub.feedback ?? ""} placeholder="Devolutiva" /><SubmitButton className="btn btn-sm">Salvar</SubmitButton></div></Form>) : <span className="hint">—</span>}</td></tr>);
            })}
          </tbody></table>
        </section>)}
      {task.status !== "draft" && (
        <section className="card"><h3 className="mb-1 text-lg">Lançar no caderno de notas</h3>
          <p className="hint mb-3">Só notas já corrigidas entram. Sem entrega só vira “N” depois de encerrar a tarefa. {task.gradeItemId ? "Esta tarefa já tem coluna no caderno; lançar de novo atualiza as notas." : ""}</p>
          <Form action={launchGradesAction.bind(null, id, task.id)}><div className="flex flex-wrap items-end gap-2"><div className="field !mb-0"><label htmlFor="period">Período</label><select id="period" name="period" className="input">{rules.periods.map((p) => <option key={p}>{p}</option>)}</select></div><SubmitButton className="btn">Lançar notas</SubmitButton></div></Form></section>)}
    </div>
  );
}
