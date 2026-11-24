"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { liveQuizzes, liveGames } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { validarPerguntas } from "@/lib/core/quiz";
import { novoCodigoLivre } from "@/lib/quiz";
import type { FormState } from "@/components/form";

export async function salvarQuizAction(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const title = String(fd.get("title") ?? "").trim().slice(0, 120);
  if (title.length < 2) return { error: "Dê um nome ao quiz." };
  let bruto: unknown = []; try { bruto = JSON.parse(String(fd.get("perguntas") ?? "[]")); } catch { /* inválido */ }
  const { perguntas, erros } = validarPerguntas(bruto);
  if (erros.length) return { error: erros.slice(0, 3).join(" ") };
  if (!perguntas.length) return { error: "Adicione ao menos uma pergunta com 2 a 4 opções e a resposta certa marcada." };
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
