import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks, taskSubmissions, taskAttachments } from "@/db/schema";
import { requirePortal } from "@/lib/portal";
import { Form, SubmitButton } from "@/components/form";
import { submitTaskAction } from "../actions";
import { studentStatus, canSubmit, TASK_STATUS_LABEL } from "@/lib/core/tasks";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Tarefa" };

export default async function PortalTarefa({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aluno?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await requirePortal(sp.aluno);
  const [t] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!t || t.status === "draft" || !p.classIds.includes(t.classId)) notFound();
  const [sub] = await db.select().from(taskSubmissions).where(and(eq(taskSubmissions.taskId, t.id), eq(taskSubmissions.studentId, p.student.id))).limit(1);
  const files = await db.select({ id: taskAttachments.id, name: taskAttachments.name }).from(taskAttachments).where(eq(taskAttachments.taskId, t.id));
  const mine = sub ? await db.select({ id: taskAttachments.id, name: taskAttachments.name }).from(taskAttachments).where(eq(taskAttachments.submissionId, sub.id)) : [];
  const now = new Date();
  const subLike = sub ? { status: sub.status, submittedAt: sub.submittedAt, grade: sub.grade } : null;
  const st = studentStatus(t, subLike, now); const can = canSubmit(t, subLike, now);
  const isStudent = p.ctx.org.role === "student";
  const graded = sub?.status === "graded";
  return (
    <div className="max-w-2xl space-y-5">
      <p className="hint"><Link href="/portal/tarefas">Tarefas</Link> › {t.title}</p>
      <div><h1>{t.title}</h1><p className="hint">{t.dueAt ? `Prazo: ${fmtDateTime(t.dueAt)}` : "Sem prazo"} · {String(Number(t.points)).replace(".", ",")} pontos · <span className={`badge ${st === "atrasada" ? "badge-amber" : ""}`}>{TASK_STATUS_LABEL[st]}</span></p></div>
      <section className="card">{t.description ? <p className="whitespace-pre-line">{t.description}</p> : <p className="text-ink-soft">Sem orientações.</p>}
        {t.resourceUrl && <p className="mt-2"><a href={t.resourceUrl} target="_blank" rel="noreferrer">Abrir recurso</a></p>}
        {files.length > 0 && <ul className="mt-3 space-y-1 text-sm">{files.map((f) => <li key={f.id}><a href={`/api/anexo/${f.id}`}>{f.name}</a></li>)}</ul>}</section>
      {graded && <section className="card-tint"><p className="font-semibold">Nota: {String(Number(sub!.grade)).replace(".", ",")} / {String(Number(t.points)).replace(".", ",")}</p>{sub!.feedback && <p className="mt-1 whitespace-pre-line">{sub!.feedback}</p>}</section>}
      {isStudent ? (
        can.ok || sub ? (
          <section className="card"><h2 className="mb-2 text-lg">{can.ok ? (sub && sub.status !== "draft" ? "Reenviar" : "Sua resposta") : "Sua entrega"}</h2>
            {sub?.submittedAt && <p className="ok mb-2" role="status">Entregue em {fmtDateTime(sub.submittedAt)}{sub.version > 1 ? ` (versão ${sub.version})` : ""}.</p>}
            {!can.ok && <p className="hint mb-2">{can.reason}</p>}
            {can.ok ? (
              <Form action={submitTaskAction.bind(null, t.id)} toast>
                {t.questions.map((q, i) => (
                  <fieldset key={q.id} className="field"><legend className="font-semibold">{i + 1}. {q.prompt} <span className="hint">({String(q.points).replace(".", ",")} pt)</span></legend>
                    {q.type === "mc" ? (q.options ?? []).map((o, k) => <label key={k} className="flex items-center gap-2 py-1 font-normal"><input type="radio" name={`q_${q.id}`} value={k} defaultChecked={sub?.answers[q.id] === k} />{String.fromCharCode(65 + k)}) {o}</label>)
                      : <textarea className="input" name={`q_${q.id}`} defaultValue={String(sub?.answers[q.id] ?? "")} aria-label={`Resposta da questão ${i + 1}`} />}
                  </fieldset>))}
                {t.kind !== "resource" && <div className="field"><label htmlFor="answerText">{t.questions.length ? "Comentário (opcional)" : "Resposta"}</label><textarea id="answerText" name="answerText" className="input" style={{ minHeight: 110 }} defaultValue={sub?.answerText ?? ""} /></div>}
                {t.kind !== "resource" && <div className="field"><label htmlFor="file">Anexar arquivo (até 4 MB){mine[0] ? ` — atual: ${mine[0].name}` : ""}</label><input id="file" name="file" type="file" className="input" /></div>}
                <div className="flex flex-wrap gap-2">
                  {t.kind !== "resource" && <SubmitButton className="btn btn-ghost" pendingLabel="Salvando…">Salvar rascunho</SubmitButton>}
                  <ModeButton /></div>
              </Form>) : (sub && <div className="text-sm"><p className="whitespace-pre-line">{sub.answerText}</p>{mine.map((f) => <p key={f.id}><a href={`/api/anexo/${f.id}`}>{f.name}</a></p>)}</div>)}
          </section>) : <p className="card-tint text-sm" role="status">{can.ok ? "" : can.reason}</p>
      ) : (<p className="card-tint text-sm">Você acompanha {p.student.name}. Somente o aluno envia a tarefa.{sub?.submittedAt ? ` Entregue em ${fmtDateTime(sub.submittedAt)}.` : ""}</p>)}
    </div>
  );
}

function ModeButton() {
  return <button type="submit" name="mode" value="submit" className="btn">Entregar</button>;
}
