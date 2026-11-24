"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assessments, assessmentItems } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { evenPoints, usedQuestionIdsForClass } from "@/lib/assessments";
import { consumeAssembly } from "@/lib/billing";
import { selecionarPorTemas } from "@/lib/montar";
import { subjectLabel } from "@/lib/taxonomy";
import { audit, track } from "@/lib/audit";
import type { FormState } from "@/components/form";

/** Dificuldade-alvo (1 a 5) pela série. As questões do banco têm dificuldade 3 por padrão, então é só uma preferência. */

/** Monta a prova a partir de temas, série e disciplina: pesquisa no banco, escolhe e abre direto no editor. */
export async function montarProvaAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const p = z.object({
    title: z.string().trim().max(140).optional(),
    classId: z.string().optional(),
    grade: z.string().min(1, "Escolha a série."),
    subject: z.string().min(1, "Escolha a disciplina."),
    themes: z.string().trim().min(2, "Escreva ao menos um tema (ex.: Machado de Assis, funções, Revolução Francesa)."),
    count: z.coerce.number().int().min(1).max(60),
    dificuldade: z.coerce.number().int().min(0).max(5).optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const classId = p.data.classId || null;
  if (classId) await loadClass(ctx, classId);
  const insts = fd.getAll("inst").map(String).filter(Boolean);
  const temas = p.data.themes.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean).slice(0, 8);

  const r = await selecionarPorTemas({ orgId: ctx.org.id, temas, subject: p.data.subject, grade: p.data.grade, count: p.data.count, insts, dificuldade: p.data.dificuldade, usedIds: await usedQuestionIdsForClass(classId) });
  if (!r.termos) return { error: "Não entendi os temas. Tente palavras como “porcentagem” ou “Machado de Assis”." };
  const picked = r.picked;
  if (!picked.length) return { error: "Não encontrei questões liberadas para esses temas. Tente outros termos, mude a disciplina para “Todas” ou remova o filtro de bancas." };

  // 4) cria a prova, cobra a cota e abre no editor
  const title = p.data.title || `Prova de ${subjectLabel(p.data.subject === "todas" ? "interdisciplinar" : p.data.subject)} — ${temas.slice(0, 2).join(", ")}`;
  const [a] = await db.insert(assessments).values({
    orgId: ctx.org.id, classId, ownerId: ctx.user.id, title, scope: { willFall: [...new Set(picked.flatMap((s) => [...s.q.assessed, ...s.q.prerequisites]))], prerequisite: [], notTaught: [], confirm: [], sources: {} },
    wantedCount: p.data.count, durationMin: Math.max(10, picked.length * 4), totalPoints: "10", filters: { institutions: insts, difficulty: [] },
  }).returning();
  const cota = await consumeAssembly(ctx.org.id, a.id);
  if (!cota.ok) { await db.delete(assessments).where(eq(assessments.id, a.id)); return { error: `${cota.reason} Você ainda pode montar manualmente pelo Banco de questões.` }; }
  const pts = evenPoints(10, picked.length);
  await db.insert(assessmentItems).values(picked.map((s, i) => {
    const hit = temas.find((_, k) => s.porTema[k] > 0);
    return { assessmentId: a.id, questionId: s.q.id, position: i + 1, points: String(pts[i]), reason: `${hit ? `Tema “${hit}”. ` : "Relacionada aos temas pedidos. "}${s.q.institution} ${s.q.year}.` };
  }));
  await audit(ctx.user.id, ctx.org.id, "assessment.composed", a.id, { temas, found: picked.length });
  await track("search_done", ctx.user.id, ctx.org.id, { found: picked.length, wanted: p.data.count });
  redirect(`/app/provas/${a.id}/editar?novo=${picked.length}-${p.data.count}`);
}
