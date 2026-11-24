import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { liveQuizzes } from "@/db/schema";
import { PageHead } from "@/components/page-head";
import { ConfirmButton } from "@/components/form";
import { QuizBuilder } from "../builder";
import { iniciarJogoAction, excluirQuizAction } from "../actions";

export const metadata = { title: "Quiz" };
export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const ctx = await requireCtx();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [q] = await db.select().from(liveQuizzes).where(and(eq(liveQuizzes.id, id), eq(liveQuizzes.ownerId, ctx.user.id))).limit(1);
  if (!q) notFound();
  return (
    <div className="space-y-4">
      <PageHead icon="quiz" title={q.title} sub={`${q.perguntas.length} pergunta(s)`} actions={<form action={iniciarJogoAction.bind(null, id)}><button className="btn" type="submit" data-testid="iniciar-jogo">Iniciar jogo</button></form>} />
      <div className="qb-wrap"><QuizBuilder id={id} titulo={q.title} inicial={q.perguntas} />
        <form action={excluirQuizAction.bind(null, id)} className="mt-3"><ConfirmButton message="Excluir este quiz?" className="link-btn text-danger">Excluir quiz</ConfirmButton></form></div>
    </div>
  );
}
