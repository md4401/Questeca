"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { descriptiveOpinions } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { gatherOpinionData, periodLabel, validPeriod } from "@/lib/opinions";
import { templateOpinion } from "@/lib/core/opinion";
import { aiAvailable, aiOpinion } from "@/lib/ai";
import { audit, track } from "@/lib/audit";
import type { FormState } from "@/components/form";

/** Gera rascunhos do mês para quem ainda não tem parecer aprovado. Nunca sobrescreve texto aprovado nem editado à mão. */
export async function generateOpinionsAction(classId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  await loadClass(ctx, classId);
  const period = String(fd.get("period") ?? "");
  if (!validPeriod(period)) return { error: "Escolha o mês." };
  const data = await gatherOpinionData(ctx, classId, period);
  const existing = new Map((await db.select().from(descriptiveOpinions).where(and(eq(descriptiveOpinions.classId, classId), eq(descriptiveOpinions.period, period)))).map((o) => [o.studentId, o]));
  let made = 0, kept = 0, empty = 0, ai = 0;
  for (const d of data) {
    const ex = existing.get(d.student.id);
    if (ex && (ex.status === "approved" || ex.origin === "manual")) { kept++; continue; }
    const input = { name: d.student.name, periodLabel: periodLabel(period), tags: d.tags, notes: d.notes, attendancePct: d.attendancePct, average: d.average };
    let text = templateOpinion(input); let origin = "modelo";
    if (!text) { empty++; continue; }
    if (aiAvailable()) { try { text = await aiOpinion(input); origin = "ia"; ai++; } catch { /* mantém o modelo */ } }
    const evidence = { observations: d.observations, attendancePct: d.attendancePct, average: d.average };
    await db.insert(descriptiveOpinions).values({ classId, studentId: d.student.id, period, text, origin, status: "draft", evidence, updatedBy: ctx.user.id })
      .onConflictDoUpdate({ target: [descriptiveOpinions.classId, descriptiveOpinions.studentId, descriptiveOpinions.period], set: { text, origin, status: "draft", evidence, updatedBy: ctx.user.id, updatedAt: new Date() } });
    made++;
  }
  await track("opinions_generated", ctx.user.id, ctx.org.id, { made, ai });
  revalidatePath(`/app/turmas/${classId}/pareceres`);
  return { ok: `${made} rascunho(s) gerado(s)${ai ? ` (${ai} com IA)` : ""}. ${kept ? `${kept} já aprovado(s)/editado(s), mantido(s). ` : ""}${empty ? `${empty} aluno(s) sem registros no mês: nada foi inventado.` : ""}`.trim() };
}

export async function saveOpinionAction(classId: string, studentId: string, period: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  await loadClass(ctx, classId);
  if (!validPeriod(period)) return { error: "Mês inválido." };
  const text = String(fd.get("text") ?? "").trim().slice(0, 4000);
  if (text.length < 10) return { error: "Escreva o parecer (mínimo 10 caracteres)." };
  const approve = fd.get("intent") === "approve";
  const [ex] = await db.select().from(descriptiveOpinions).where(and(eq(descriptiveOpinions.classId, classId), eq(descriptiveOpinions.studentId, studentId), eq(descriptiveOpinions.period, period))).limit(1);
  const origin = ex && ex.text === text ? ex.origin : "manual";
  await db.insert(descriptiveOpinions).values({ classId, studentId, period, text, origin, status: approve ? "approved" : "draft", updatedBy: ctx.user.id })
    .onConflictDoUpdate({ target: [descriptiveOpinions.classId, descriptiveOpinions.studentId, descriptiveOpinions.period], set: { text, origin, status: approve ? "approved" : "draft", updatedBy: ctx.user.id, updatedAt: new Date() } });
  if (approve) await audit(ctx.user.id, ctx.org.id, "opinion.approved", studentId, { period });
  revalidatePath(`/app/turmas/${classId}/pareceres`);
  return { ok: approve ? "Parecer aprovado." : "Rascunho salvo." };
}
