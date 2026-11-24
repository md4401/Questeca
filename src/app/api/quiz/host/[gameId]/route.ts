import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { liveGames, livePlayers, liveAnswers } from "@/db/schema";
import { getStaffCtx } from "@/lib/session";
import { ranking } from "@/lib/core/quiz";

export const dynamic = "force-dynamic";
/** Estado do jogo para o professor (quem entrou, quantos responderam, placar). Só o dono do jogo. */
export async function GET(_: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const ctx = await getStaffCtx();
  if (!ctx || !/^[0-9a-f-]{36}$/i.test(gameId)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const [g] = await db.select().from(liveGames).where(and(eq(liveGames.id, gameId), eq(liveGames.hostId, ctx.user.id))).limit(1);
  if (!g) return NextResponse.json({ error: "Jogo não encontrado." }, { status: 404 });
  const jogadores = await db.select({ id: livePlayers.id, nickname: livePlayers.nickname, score: livePlayers.score }).from(livePlayers).where(eq(livePlayers.gameId, g.id));
  const resp = g.current >= 0 ? await db.select({ choice: liveAnswers.choice }).from(liveAnswers).where(and(eq(liveAnswers.gameId, g.id), eq(liveAnswers.q, g.current))) : [];
  const p = g.perguntas[g.current];
  const contagem = p ? p.opcoes.map((_, i) => resp.filter((r) => r.choice === i).length) : [];
  const decorrido = g.questionStartedAt ? Date.now() - g.questionStartedAt.getTime() : 0;
  return NextResponse.json({
    state: g.state, current: g.current, total: g.perguntas.length, code: g.code,
    pergunta: p ? { texto: p.texto, opcoes: p.opcoes, segundos: p.segundos, restanteMs: g.state === "question" ? Math.max(0, p.segundos * 1000 - decorrido) : 0, certa: g.state === "question" ? null : p.certa } : null,
    respondidas: resp.length, contagem: g.state === "question" ? null : contagem,
    jogadores: ranking(jogadores).map(({ nickname, score, pos }) => ({ nickname, score, pos })),
  }, { headers: { "cache-control": "no-store" } });
}
