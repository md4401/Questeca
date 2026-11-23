import Link from "next/link";
import { desc, eq, inArray, count } from "drizzle-orm";
import { db } from "@/db";
import { quizzes, quizAttempts } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { Form, SubmitButton } from "@/components/form";
import { QuizFields } from "@/components/quiz-fields";
import { createQuizAction } from "./actions";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Quizzes" };
const ST: Record<string, string> = { draft: "Rascunho", published: "Publicado", closed: "Encerrado" };

export default async function Quizzes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const list = await db.select().from(quizzes).where(eq(quizzes.classId, id)).orderBy(desc(quizzes.createdAt));
  const att = list.length ? await db.select({ q: quizAttempts.quizId, n: count() }).from(quizAttempts).where(inArray(quizAttempts.quizId, list.map((x) => x.id))).groupBy(quizAttempts.quizId) : [];
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="card"><h2 className="mb-1 text-lg">Quizzes da turma</h2>
        <p className="hint mb-3">Práticas formativas, separadas das provas formais e do banco oficial de questões.</p>
        {list.length === 0 ? <p className="text-ink-soft">Nenhum quiz ainda.</p> : <ul className="divide-y divide-line">{list.map((q) => <li key={q.id} className="py-3"><Link href={`/app/turmas/${id}/quizzes/${q.id}`} className="font-semibold">{q.title}</Link> <span className="badge">{ST[q.status]}</span>{q.aiGenerated && <span className="badge badge-amber ml-1">IA</span>}<p className="hint">{q.items.length} questão(ões) · {q.timeLimitMin ? `${q.timeLimitMin} min` : "sem limite"} · {q.maxAttempts} tentativa(s) · {q.dueAt ? `até ${fmtDateTime(q.dueAt)}` : "sem prazo"} · {Number(att.find((a) => a.q === q.id)?.n ?? 0)} tentativa(s) feitas</p></li>)}</ul>}
      </section>
      <section className="card"><h2 className="mb-2 text-lg">Novo quiz</h2><Form action={createQuizAction.bind(null, id)}><QuizFields /><SubmitButton pendingLabel="Criando…">Criar rascunho</SubmitButton></Form></section>
    </div>
  );
}
