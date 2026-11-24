import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { liveGames, livePlayers, liveAnswers } from "@/db/schema";
import { gerarCodigo, normalizarApelido, normalizarCodigo, pontosDaResposta, ranking } from "@/lib/core/quiz";

export async function novoCodigoLivre(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const c = gerarCodigo();
    const [x] = await db.select({ id: liveGames.id }).from(liveGames).where(eq(liveGames.code, c)).limit(1);
    if (!x) return c;
  }
  throw new Error("Não foi possível gerar um código.");
}

export async function entrar(codeRaw: string, nickRaw: string): Promise<{ ok: true; playerId: string; secret: string } | { ok: false; error: string }> {
  const code = normalizarCodigo(codeRaw); const nickname = normalizarApelido(nickRaw);
  if (code.length !== 6) return { ok: false, error: "O código tem 6 letras/números." };
  if (nickname.length < 2) return { ok: false, error: "Escolha um apelido com pelo menos 2 letras." };
  const [g] = await db.select().from(liveGames).where(eq(liveGames.code, code)).limit(1);
  if (!g || g.state === "ended") return { ok: false, error: "Jogo não encontrado ou já encerrado." };
  const secret = randomBytes(12).toString("base64url");
  try {
    const [p] = await db.insert(livePlayers).values({ gameId: g.id, nickname, secret }).returning({ id: livePlayers.id });
    return { ok: true, playerId: p.id, secret };
  } catch { return { ok: false, error: "Esse apelido já está em uso neste jogo. Escolha outro." }; }
}

async function jogoPorCodigo(code: string) {
  const [g] = await db.select().from(liveGames).where(eq(liveGames.code, normalizarCodigo(code))).limit(1);
  return g ?? null;
}

export async function estadoDoJogador(codeRaw: string, playerId: string, secret: string) {
  const g = await jogoPorCodigo(codeRaw);
  if (!g) return null;
  const [me] = await db.select().from(livePlayers).where(and(eq(livePlayers.id, playerId), eq(livePlayers.gameId, g.id))).limit(1);
  if (!me || me.secret !== secret) return null;
  const jogadores = await db.select({ id: livePlayers.id, nickname: livePlayers.nickname, score: livePlayers.score }).from(livePlayers).where(eq(livePlayers.gameId, g.id));
  const total = g.perguntas.length; const base = { state: g.state, total, current: g.current, jogadores: jogadores.length, meuApelido: me.nickname, meuTotal: me.score };
  if (g.state === "lobby") return base;
  const p = g.perguntas[g.current];
  const meu = p ? (await db.select().from(liveAnswers).where(and(eq(liveAnswers.gameId, g.id), eq(liveAnswers.playerId, me.id), eq(liveAnswers.q, g.current))).limit(1))[0] : undefined;
  if (g.state === "question" && p) {
    const decorrido = Date.now() - (g.questionStartedAt?.getTime() ?? Date.now());
    return { ...base, pergunta: { texto: p.texto, opcoes: p.opcoes, segundos: p.segundos, restanteMs: Math.max(0, p.segundos * 1000 - decorrido) }, respondi: meu ? meu.choice : null };
  }
  const rk = ranking(jogadores);
  const pos = rk.find((r) => r.id === me.id)?.pos ?? null;
  if (g.state === "results" && p) {
    const contagem = p.opcoes.map(() => 0);
    (await db.select({ choice: liveAnswers.choice }).from(liveAnswers).where(and(eq(liveAnswers.gameId, g.id), eq(liveAnswers.q, g.current)))).forEach((a) => { if (contagem[a.choice] !== undefined) contagem[a.choice]++; });
    return { ...base, pergunta: { texto: p.texto, opcoes: p.opcoes, segundos: p.segundos, restanteMs: 0 }, certa: p.certa, contagem, respondi: meu ? meu.choice : null, acertei: meu?.correct ?? false, meusPontos: meu?.points ?? 0, pos, top: rk.slice(0, 5).map(({ nickname, score, pos: ps }) => ({ nickname, score, pos: ps })) };
  }
  return { ...base, pos, top: rk.slice(0, 10).map(({ nickname, score, pos: ps }) => ({ nickname, score, pos: ps })) };
}

export async function responder(codeRaw: string, playerId: string, secret: string, choice: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const g = await jogoPorCodigo(codeRaw);
  if (!g || g.state !== "question") return { ok: false, error: "Esta pergunta já terminou." };
  const [me] = await db.select().from(livePlayers).where(and(eq(livePlayers.id, playerId), eq(livePlayers.gameId, g.id))).limit(1);
  if (!me || me.secret !== secret) return { ok: false, error: "Jogador inválido." };
  const p = g.perguntas[g.current];
  if (!p || !Number.isInteger(choice) || choice < 0 || choice >= p.opcoes.length) return { ok: false, error: "Opção inválida." };
  const ms = Date.now() - (g.questionStartedAt?.getTime() ?? Date.now());
  if (ms > p.segundos * 1000 + 1500) return { ok: false, error: "Tempo esgotado." };
  const correct = choice === p.certa; const points = pontosDaResposta(correct, ms, p.segundos);
  const ins = await db.insert(liveAnswers).values({ gameId: g.id, playerId: me.id, q: g.current, choice, ms, correct, points }).onConflictDoNothing().returning({ q: liveAnswers.q });
  if (!ins.length) return { ok: false, error: "Você já respondeu." };
  if (points) await db.update(livePlayers).set({ score: sql`${livePlayers.score} + ${points}` }).where(eq(livePlayers.id, me.id));
  return { ok: true };
}
