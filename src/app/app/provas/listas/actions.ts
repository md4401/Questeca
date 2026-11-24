"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { assessments, assessmentItems } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { criarProvaPorTemas } from "@/lib/montar";
import { ordemEmbaralhada } from "@/lib/core/listas";
import type { FormState } from "@/components/form";

/** Cria a lista A e a B com as MESMAS questões; a B só muda a ordem (embaralhada). */
export async function criarListasABAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const p = z.object({
    grade: z.string().min(1, "Escolha a série."), subject: z.string().min(1, "Escolha a disciplina."),
    themes: z.string().trim().min(2, "Escreva ao menos um tema."), count: z.coerce.number().int().min(2).max(25),
    classId: z.string().optional(), title: z.string().trim().max(100).optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const nome = p.data.title || `Lista — ${p.data.themes.split(/[,;\n]/)[0].trim()}`;
  const r = await criarProvaPorTemas(ctx, { title: `${nome} (versão A)`, classId: p.data.classId || null, grade: p.data.grade, subject: p.data.subject, temas: p.data.themes.split(/[,;\n]+/), count: p.data.count, ia: "banco" });
  if (!r.ok) return { error: r.error };
  const [a] = await db.select().from(assessments).where(and(eq(assessments.id, r.id), eq(assessments.ownerId, ctx.user.id))).limit(1);
  const itens = await db.select().from(assessmentItems).where(eq(assessmentItems.assessmentId, r.id)).orderBy(asc(assessmentItems.position));
  if (!a || itens.length < 2) return { error: "Encontrei poucas questões para embaralhar. Amplie os temas." };
  const { id: _id, createdAt: _c, updatedAt: _u, ...base } = a; void _id; void _c; void _u;
  const [b] = await db.insert(assessments).values({ ...base, title: `${nome} (versão B)` }).returning({ id: assessments.id });
  await db.insert(assessmentItems).values(ordemEmbaralhada(itens).map((it, i) => { const { id: _i, ...rest } = it; void _i; return { ...rest, assessmentId: b.id, position: i + 1 }; }));
  redirect(`/app/provas?listas=${a.id}.${b.id}`);
}
