"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { liveQuizzes, liveGames } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { lerPerguntas, perguntasParaTexto } from "@/lib/core/quiz";
import { novoCodigoLivre } from "@/lib/quiz";
import { aiAvailable, aiComplete } from "@/lib/ai";
import { SemCreditos } from "@/lib/credits";
import type { FormState } from "@/components/form";

export async function salvarQuizAction(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  if (title.length < 2) return { error: "Dê um nome ao quiz." };
  const { perguntas, erros } = lerPerguntas(String(fd.get("texto") ?? ""));
  if (erros.length) return { error: erros.slice(0, 3).join(" ") };
  if (!perguntas.length) return { error: "Escreva ao menos uma pergunta com 2 a 4 opções (use * na certa)." };
  if (id) {
    const r = await db.update(liveQuizzes).set({ title, perguntas }).where(and(eq(liveQuizzes.id, id), eq(liveQuizzes.ownerId, ctx.user.id))).returning({ id: liveQuizzes.id });
    if (!r.length) return { error: "Quiz não encontrado." };
    revalidatePath(`/app/quiz/${id}`); return { ok: "Quiz salvo." };
  }
  const [q] = await db.insert(liveQuizzes).values({ orgId: ctx.org.id, ownerId: ctx.user.id, title, perguntas }).returning({ id: liveQuizzes.id });
  redirect(`/app/quiz/${q.id}`);
}

export async function excluirQuizAction(id: string) {
  const ctx = await requireCtx();
  await db.delete(liveQuizzes).where(and(eq(liveQuizzes.id, id), eq(liveQuizzes.ownerId, ctx.user.id)));
  redirect("/app/quiz");
}

/** A GizIA escreve as perguntas no formato do editor; o professor revisa antes de salvar. */
export async function gerarQuizIAAction(_: FormState, fd: FormData): Promise<FormState & { texto?: string }> {
  await requireCtx();
  const tema = String(fd.get("tema") ?? "").trim().slice(0, 200);
  const serie = String(fd.get("serie") ?? "").trim().slice(0, 40);
  const n = Math.min(15, Math.max(3, Number(fd.get("n")) || 8));
  if (tema.length < 3) return { error: "Escreva o tema do quiz." };
  if (!aiAvailable()) return { error: "A GizIA não está ativada nesta instalação." };
  try {
    const out = await aiComplete(
      "Você cria quizzes de sala de aula em português do Brasil. Responda SOMENTE com as perguntas, sem comentários, neste formato exato: enunciado curto em uma linha; depois 4 linhas de opção, a certa começando com '* ' e as erradas com '- '; uma linha em branco entre perguntas. Perguntas claras, uma única resposta certa, erradas plausíveis, sem pegadinhas ambíguas. Varie a posição da certa.",
      `Tema: ${tema}${serie ? `\nPúblico: ${serie}` : ""}\nQuantidade: ${n} perguntas.`, 3500, 100_000);
    const r = lerPerguntas(out.replace(/```[a-z]*/gi, ""));
    if (!r.perguntas.length) return { error: "A GizIA não conseguiu montar as perguntas agora. Tente de novo." };
    return { ok: `${r.perguntas.length} pergunta(s) geradas. Revise antes de salvar.`, texto: perguntasParaTexto(r.perguntas) };
  } catch (e) { return { error: e instanceof SemCreditos ? "Seus créditos de IA de hoje acabaram." : "A GizIA não respondeu agora. Tente de novo." }; }
}

export async function iniciarJogoAction(quizId: string) {
  const ctx = await requireCtx();
  const [q] = await db.select().from(liveQuizzes).where(and(eq(liveQuizzes.id, quizId), eq(liveQuizzes.ownerId, ctx.user.id))).limit(1);
  if (!q || !q.perguntas.length) redirect("/app/quiz");
  const [g] = await db.insert(liveGames).values({ quizId, hostId: ctx.user.id, code: await novoCodigoLivre(), perguntas: q.perguntas }).returning({ id: liveGames.id });
  redirect(`/app/quiz/jogo/${g.id}`);
}

/** Avança o jogo: sala → pergunta 1 → (resultado) → pergunta 2 … → fim. */
export async function avancarAction(gameId: string) {
  const ctx = await requireCtx();
  const [g] = await db.select().from(liveGames).where(and(eq(liveGames.id, gameId), eq(liveGames.hostId, ctx.user.id))).limit(1);
  if (!g || g.state === "ended") return;
  if (g.state === "question") { await db.update(liveGames).set({ state: "results" }).where(eq(liveGames.id, gameId)); return; }
  const next = g.current + 1;
  if (next >= g.perguntas.length) { await db.update(liveGames).set({ state: "ended" }).where(eq(liveGames.id, gameId)); return; }
  await db.update(liveGames).set({ state: "question", current: next, questionStartedAt: new Date() }).where(eq(liveGames.id, gameId));
}
export async function encerrarJogoAction(gameId: string) {
  const ctx = await requireCtx();
  await db.update(liveGames).set({ state: "ended" }).where(and(eq(liveGames.id, gameId), eq(liveGames.hostId, ctx.user.id)));
}
