import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { liveQuizzes } from "@/db/schema";
import { PageHead } from "@/components/page-head";
import { perguntasParaTexto } from "@/lib/core/quiz";
import { QuizEditor } from "../editor";
import { iniciarJogoAction } from "../actions";

export const metadata = { title: "Quiz" };
export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const ctx = await requireCtx();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [q] = await db.select().from(liveQuizzes).where(and(eq(liveQuizzes.id, id), eq(liveQuizzes.ownerId, ctx.user.id))).limit(1);
  if (!q) notFound();
  return (
    <div className="space-y-4">
      <PageHead icon="prova" title={q.title} sub={`${q.perguntas.length} pergunta(s)`} actions={<form action={iniciarJogoAction.bind(null, id)}><button className="btn" type="submit" data-testid="iniciar-jogo">Iniciar jogo</button></form>} />
      <QuizEditor id={id} title={q.title} texto={perguntasParaTexto(q.perguntas)} />
    </div>
  );
}
