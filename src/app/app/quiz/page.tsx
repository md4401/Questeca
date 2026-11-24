import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { liveQuizzes } from "@/db/schema";
import { PageHead } from "@/components/page-head";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Quiz ao vivo" };
export default async function QuizList() {
  const ctx = await requireCtx();
  const list = await db.select().from(liveQuizzes).where(eq(liveQuizzes.ownerId, ctx.user.id)).orderBy(desc(liveQuizzes.createdAt));
  return (
    <div className="space-y-4">
      <PageHead icon="quiz" title="Quiz ao vivo" sub="Jogue com a turma: os alunos entram pelo celular com um código e respondem valendo pontos." actions={<Link className="btn" href="/app/quiz/novo" data-testid="novo-quiz">Novo quiz</Link>} />
      {list.length === 0 ? <section className="card text-ink-soft">Nenhum quiz ainda. Crie o primeiro: escreva as perguntas ou peça para a GizIA gerar por tema.</section> : (
        <ul className="grid gap-3 sm:grid-cols-2">{list.map((q) => (
          <li key={q.id} className="card"><h2 className="text-lg">{q.title}</h2><p className="hint">{q.perguntas.length} pergunta(s) · {fmtDate(q.createdAt)}</p><div className="mt-3 flex gap-3"><Link className="btn btn-sm" href={`/app/quiz/${q.id}`}>Abrir</Link></div></li>))}</ul>)}
    </div>
  );
}
