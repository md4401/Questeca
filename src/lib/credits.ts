import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { creditsOf } from "@/lib/core/credits";

/**
 * Cota diária por professor: 200 créditos (200 mil tokens). Com a entrevista antes de criar, uma prova pedida à GizIA faz ≈ 4 chamadas
 * (entrevista, criação, ampliar temas e resposta) e gasta ≈ 11 a 12 mil tokens (≈ 11 a 12 créditos, sem contar o raciocínio interno do modelo);
 * uma apresentação com fotos gasta algo parecido. 10 provas por dia ≈ 120 créditos, com folga para planos e apresentações.
 * O formulário "Montar prova" gasta ≈ 0,2 crédito. O gasto real é medido e gravado a cada chamada.
 */
export const CREDITOS_POR_DIA = Number(process.env.AI_DAILY_CREDITS) > 0 ? Number(process.env.AI_DAILY_CREDITS) : 200;

export class SemCreditos extends Error { constructor() { super("Seus créditos de IA de hoje acabaram. Eles voltam amanhã; enquanto isso você pode montar provas e planos sem IA."); } }

const diaSP = sql`(date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')`;

export async function tokensHoje(userId: string): Promise<number> {
  const [r] = await db.select({ t: sql<number>`coalesce(sum(${aiUsage.tokens}), 0)::int` }).from(aiUsage).where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, diaSP)));
  return r?.t ?? 0;
}
export async function creditosHoje(userId: string) {
  const usados = creditsOf(await tokensHoje(userId));
  return { usados, limite: CREDITOS_POR_DIA, restantes: Math.max(0, CREDITOS_POR_DIA - usados) };
}
export async function exigirCreditos(userId: string) { if ((await creditosHoje(userId)).restantes <= 0) throw new SemCreditos(); }
export async function registrarUso(u: { userId: string; orgId: string | null; kind: string; promptTokens: number; completionTokens: number }) {
  await db.insert(aiUsage).values({ userId: u.userId, orgId: u.orgId, kind: u.kind, promptTokens: u.promptTokens, completionTokens: u.completionTokens, tokens: u.promptTokens + u.completionTokens });
}
