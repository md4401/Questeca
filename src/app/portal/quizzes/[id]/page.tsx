import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { quizzes, quizAttempts } from "@/db/schema";
import { requirePortal } from "@/lib/portal";
import { canStart, scoreAttempt, canSeeExplanations } from "@/lib/core/quiz";
import { startQuizAction } from "../actions";
import { QuizRunner } from "@/components/quiz-runner";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Quiz" };

export default async function PortalQuiz({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await requirePortal();
  const [q] = await db.select().from(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.orgId, p.ctx.org.id))).limit(1);
  if (!q || q.status === "draft" || !p.classIds.includes(q.classId)) notFound();
  const attempts = await db.select().from(quizAttempts).where(and(eq(quizAttempts.quizId, q.id), eq(quizAttempts.studentId, p.student.id))).orderBy(quizAttempts.attemptNo);
  const now = new Date();
  const isStudent = p.ctx.org.role === "student";
  const open = attempts.find((a) => a.status === "in_progress" && (!a.deadlineAt || a.deadlineAt > now));
  const chk = canStart(q, attempts.map((a) => ({ attemptNo: a.attemptNo, status: a.status, deadlineAt: a.deadlineAt })), now);
  const showExp = canSeeExplanations(q.explanations, q.dueAt, now);
  if (isStudent && open) {
    return (
      <div className="max-w-2xl space-y-3"><p className="hint"><Link href="/portal/quizzes">Quizzes</Link> › {q.title}</p><h1>{q.title}</h1>
        <QuizRunner attemptId={open.id} deadlineMs={open.deadlineAt ? open.deadlineAt.getTime() : null} items={q.items.map(({ id: i, type, prompt, options, points }) => ({ id: i, type, prompt, options, points }))} /></div>);
  }
  return (
    <div className="max-w-2xl space-y-4">
      <p className="hint"><Link href="/portal/quizzes">Quizzes</Link> › {q.title}</p><h1>{q.title}</h1>
      <section className="card"><p>{q.description || "Sem descrição."}</p><p className="hint mt-1">{q.items.length} questão(ões){q.timeLimitMin ? ` · ${q.timeLimitMin} min` : " · sem limite de tempo"} · {q.maxAttempts} tentativa(s){q.dueAt ? ` · até ${fmtDateTime(q.dueAt)}` : ""}</p>
        {isStudent ? (chk.ok ? <form action={startQuizAction.bind(null, q.id)} className="mt-3"><button className="btn" type="submit">{attempts.length ? "Nova tentativa" : "Começar quiz"}</button></form> : <p className="card-tint mt-3 text-sm" role="status">{chk.reason}</p>) : <p className="card-tint mt-3 text-sm">Você acompanha {p.student.name}. Somente o aluno responde.</p>}</section>
      {attempts.filter((a) => a.status !== "in_progress").map((a) => {
        const r = scoreAttempt(q.items, a.answers, a.manualScores);
        return (
          <section key={a.id} className="card" aria-label={`Tentativa ${a.attemptNo}`}><h2 className="text-lg">Tentativa {a.attemptNo} — {a.status === "expired" ? "tempo esgotado" : `${String(r.score).replace(".", ",")} de ${String(r.max).replace(".", ",")} (${String(r.pct).replace(".", ",")}%)`}</h2>
            {a.status === "submitted" && r.review && <p className="hint">Discursivas aguardam correção do professor.</p>}
            {a.status === "submitted" && <ul className="mt-2 space-y-2 text-sm">{q.items.map((it, i) => { const d = r.detail[i]; return <li key={it.id}><strong>{i + 1}.</strong> {it.prompt} — {d.ok === null ? (d.pending ? "aguardando correção" : "discursiva") : d.ok ? "✔ acertou" : "✘ errou"}{showExp && it.explanation && <p className="hint">{it.explanation}</p>}</li>; })}</ul>}
            {a.status === "submitted" && !showExp && q.explanations !== "never" && <p className="hint mt-2">As explicações serão liberadas depois do prazo.</p>}
          </section>);
      })}
    </div>
  );
}
