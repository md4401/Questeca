import "server-only";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { questionImages } from "@/db/schema";

export type Figura = { id: string; width: number; height: number };

/** Figuras (só metadados) por questão, na ordem em que aparecem. Uma consulta para várias questões. */
export async function figurasPorQuestao(questionIds: string[]): Promise<Map<string, Figura[]>> {
  const out = new Map<string, Figura[]>();
  if (!questionIds.length) return out;
  const rows = await db.select({ id: questionImages.id, q: questionImages.questionId, width: questionImages.width, height: questionImages.height }).from(questionImages).where(inArray(questionImages.questionId, [...new Set(questionIds)])).orderBy(asc(questionImages.questionId), asc(questionImages.position));
  for (const r of rows) (out.get(r.q) ?? out.set(r.q, []).get(r.q)!).push({ id: r.id, width: r.width, height: r.height });
  return out;
}

/** Bytes das figuras (para PDF e Word). */
export async function figurasComBytes(questionIds: string[]): Promise<Map<string, { bytes: Buffer; width: number; height: number }[]>> {
  const out = new Map<string, { bytes: Buffer; width: number; height: number }[]>();
  if (!questionIds.length) return out;
  const rows = await db.select({ q: questionImages.questionId, data: questionImages.data, width: questionImages.width, height: questionImages.height }).from(questionImages).where(inArray(questionImages.questionId, [...new Set(questionIds)])).orderBy(asc(questionImages.questionId), asc(questionImages.position));
  for (const r of rows) (out.get(r.q) ?? out.set(r.q, []).get(r.q)!).push({ bytes: r.data, width: r.width, height: r.height });
  return out;
}

/** Tamanho em pontos (1/72") de uma figura cabendo na largura/altura máximas, sem ampliar além de 1 px = 0,5 pt. */
export function ajustar(w: number, h: number, maxW: number, maxH: number) {
  const s = Math.min(maxW / w, maxH / h, 0.5);
  return { w: w * s, h: h * s };
}
