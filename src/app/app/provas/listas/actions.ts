"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { assessments, assessmentItems } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { criarProvaPorTemas } from "@/lib/montar";
import { dividirAB } from "@/lib/core/listas";
import { evenPoints } from "@/lib/assessments";
import type { FormState } from "@/components/form";

/** Cria duas listas (A e B) com questões diferentes do mesmo tema: busca 2n questões e reparte entre as duas versões. */
export async function criarListasABAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const p = z.object({
    grade: z.string().min(1, "Escolha a série."), subject: z.string().min(1, "Escolha a disciplina."),
    themes: z.string().trim().min(2, "Escreva ao menos um tema."), count: z.coerce.number().int().min(2).max(25),
    classId: z.string().optional(), title: z.string().trim().max(100).optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const nome = p.data.title || `Lista — ${p.data.themes.split(/[,;\n]/)[0].trim()}`;
  const r = await criarProvaPorTemas(ctx, { title: `${nome} (versão A)`, classId: p.data.classId || null, grade: p.data.grade, subject: p.data.subject, temas: p.data.themes.split(/[,;\n]+/), count: p.data.count * 2, ia: "banco" });
  if (!r.ok) return { error: r.error };
  const [a] = await db.select().from(assessments).where(and(eq(assessments.id, r.id), eq(assessments.ownerId, ctx.user.id))).limit(1);
  const itens = await db.select().from(assessmentItems).where(eq(assessmentItems.assessmentId, r.id)).orderBy(asc(assessmentItems.position));
  if (itens.length < 2) return { error: "Encontrei poucas questões para dividir em duas versões. Amplie os temas." };
  const { a: ia, b: ib } = dividirAB(itens);
  const { id: _id, createdAt: _c, updatedAt: _u, ...base } = a; void _id; void _c; void _u;
  const [b] = await db.insert(assessments).values({ ...base, title: `${nome} (versão B)` }).returning({ id: assessments.id });
  const pa = evenPoints(10, ia.length); const pb = evenPoints(10, ib.length);
  for (let i = 0; i < ib.length; i++) await db.update(assessmentItems).set({ assessmentId: b.id, position: i + 1, points: String(pb[i]) }).where(eq(assessmentItems.id, ib[i].id));
  for (let i = 0; i < ia.length; i++) await db.update(assessmentItems).set({ position: i + 1, points: String(pa[i]) }).where(eq(assessmentItems.id, ia[i].id));
  await db.update(assessments).set({ wantedCount: ia.length }).where(eq(assessments.id, a.id));
  await db.update(assessments).set({ wantedCount: ib.length }).where(eq(assessments.id, b.id));
  redirect(`/app/provas?listas=${a.id}.${b.id}`);
}
