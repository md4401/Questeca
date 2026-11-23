import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { quizzes, quizAttempts } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { Form, SubmitButton } from "@/components/form";
import { QuizFields } from "@/components/quiz-fields";
import { updateQuizAction, publishQuizAction, closeQuizAction, gradeAttemptAction } from "../actions";
import { scoreAttempt, gradeItem } from "@/lib/core/quiz";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Quiz" };

export default async function QuizDetalhe({ params }: { params: Promise<{ id: string; quizId: string }> }) {
  const { id, quizId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(quizId)) notFound();
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const [q] = await db.select().from(quizzes).where(and(eq(quizzes.id, quizId), eq(quizzes.classId, id))).limit(1);
  if (!q) notFound();
  const roster = await classStudents(id);
  const attempts = await db.select().from(quizAttempts).where(eq(quizAttempts.quizId, q.id)).orderBy(quizAttempts.startedAt);
  const done = attempts.filter((a) => a.status === "submitted");
  const rate = q.items.map((it) => { const g = done.map((a) => gradeItem(it, a.answers[it.id])).filter((x) => x !== null); return { it, n: g.length, ok: g.filter(Boolean).length }; });
  return (
    <div className="space-y-6">
      <p className="hint"><Link href={`/app/turmas/${id}/quizzes`}>Quizzes</Link> › {q.title}</p>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl">{q.title} <span className="badge align-middle">{{ draft: "Rascunho", published: "Publicado", closed: "Encerrado" }[q.status]}</span></h2>
        <div className="flex gap-2">{q.status === "draft" && <Form action={publishQuizAction.bind(null, id, q.id)} toast><SubmitButton>Publicar para a turma</SubmitButton></Form>}{q.status === "published" && <form action={closeQuizAction.bind(null, id, q.id)}><button className="btn btn-ghost" type="submit">Encerrar quiz</button></form>}</div></div>
      {q.status === "draft" ? <section className="card"><Form action={updateQuizAction.bind(null, id, q.id)}><QuizFields q={q} /><SubmitButton>Salvar rascunho</SubmitButton></Form></section> : (
        <section className="card text-sm"><p>{q.description || "Sem descrição."}</p><p className="hint mt-1">{q.items.length} questão(ões) · {q.timeLimitMin ? `${q.timeLimitMin} min` : "sem limite de tempo"} · {q.maxAttempts} tentativa(s) · {q.dueAt ? `até ${fmtDateTime(q.dueAt)}` : "sem prazo"}</p></section>)}
      {q.status !== "draft" && (<>
        <section className="card"><h3 className="mb-2 text-lg">Desempenho por questão</h3>
          <ul className="space-y-1 text-sm">{rate.map(({ it, n, ok }, i) => <li key={it.id}>{i + 1}. {it.prompt.slice(0, 80)} — {it.type === "text" ? "discursiva" : n === 0 ? "sem respostas" : `${Math.round((ok / n) * 100)}% de acerto (${ok}/${n})`}</li>)}</ul></section>
        <section className="card"><h3 className="mb-2 text-lg">Tentativas ({done.length} enviadas)</h3>
          <table className="t"><thead><tr><th>Aluno</th><th>Tentativa</th><th>Situação</th><th>Nota</th><th>Discursivas</th></tr></thead><tbody>
            {attempts.map((a) => {
              const st = roster.find((s) => s.id === a.studentId); const r = scoreAttempt(q.items, a.answers, a.manualScores);
              return (
                <tr key={a.id}><td>{st?.name ?? "—"}</td><td>{a.attemptNo}</td><td>{{ in_progress: "Em andamento", submitted: "Enviada", expired: "Tempo esgotado" }[a.status]}</td>
                  <td>{a.status === "submitted" ? `${String(r.score).replace(".", ",")} / ${String(r.max).replace(".", ",")}${r.review ? " (pendente)" : ""}` : "—"}</td>
                  <td>{a.status === "submitted" && q.items.some((it) => it.type === "text") ? (
                    <Form action={gradeAttemptAction.bind(null, id, q.id, a.id)}><div className="space-y-1">{q.items.filter((it) => it.type === "text").map((it) => <div key={it.id}><p className="max-w-xs text-xs text-ink-soft">{String(a.answers[it.id] ?? "(em branco)")}</p><label className="sr-only" htmlFor={`m-${a.id}-${it.id}`}>Nota da discursiva de {st?.name}</label><input id={`m-${a.id}-${it.id}`} name={`m_${it.id}`} className="input !w-20" inputMode="decimal" defaultValue={a.manualScores[it.id] != null ? String(a.manualScores[it.id]).replace(".", ",") : ""} placeholder={`/${it.points}`} /></div>)}<SubmitButton className="btn btn-sm">Salvar</SubmitButton></div></Form>) : "—"}</td></tr>);
            })}
          </tbody></table>
          {attempts.length === 0 && <p className="text-sm text-ink-soft">Nenhuma tentativa ainda.</p>}</section></>)}
    </div>
  );
}
