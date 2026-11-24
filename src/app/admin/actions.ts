"use server";
import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { questions, questionChanges, questionFlags, assessmentItems, assessments, postFlags, posts, comments, userBlocks, subscriptions, tickets } from "@/db/schema";
import { searchNormOf } from "@/lib/core/search";
import { classificar } from "@/lib/core/classificacao";
import { requireStaff } from "@/lib/session";
import { audit, notify } from "@/lib/audit";
import { TOPICS } from "@/lib/taxonomy";
import type { FormState } from "@/components/form";

const STATUSES = ["curation", "reference_only", "released", "in_review", "blocked"];

export async function setQuestionStatusAction(id: string, status: string) {
  const ctx = await requireStaff();
  if (!STATUSES.includes(status)) return;
  const [q] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!q) return;
  // liberar exige procedência, gabarito e conferência de licença
  if (status === "released" && (!q.statement || !q.answer || !q.licenseNote)) return;
  await db.update(questions).set({ status, reviewedBy: ctx.user.name, reviewedAt: new Date() }).where(eq(questions.id, id));
  await db.insert(questionChanges).values({ questionId: id, actorId: ctx.user.id, kind: "status_changed", before: { status: q.status }, after: { status } });
  await audit(ctx.user.id, null, "question.status", id, { status });
  revalidatePath("/admin");
}

/** Retifica o gabarito: registra a alteração e avisa os professores com avaliações afetadas (sem alterar notas já finalizadas). */
export async function correctAnswerAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireStaff();
  const answer = String(fd.get("answer") ?? "").trim().toUpperCase();
  const reason = String(fd.get("reason") ?? "").trim();
  if (!/^[A-E]$/.test(answer)) return { error: "Use uma letra de A a E." };
  if (reason.length < 5) return { error: "Informe a evidência/motivo da retificação." };
  const [q] = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  if (!q) return { error: "Questão não encontrada." };
  if (q.answer === answer) return { error: "O gabarito já é esse." };
  await db.update(questions).set({ answer, answerSource: `Retificado: ${reason}`, version: q.version + 1, reviewedBy: ctx.user.name, reviewedAt: new Date() }).where(eq(questions.id, id));
  await db.insert(questionChanges).values({ questionId: id, actorId: ctx.user.id, kind: "answer_changed", before: { answer: q.answer }, after: { answer, reason } });
  const items = await db.select({ aid: assessmentItems.assessmentId }).from(assessmentItems).where(eq(assessmentItems.questionId, id));
  const aids = [...new Set(items.map((i) => i.aid))];
  const affected = aids.length ? await db.select().from(assessments).where(inArray(assessments.id, aids)) : [];
  // em paralelo: a retificação não deve esperar uma consulta por prova afetada
  await Promise.all(affected.map((a) => notify(a.ownerId, "correcao", "Gabarito retificado em uma questão da sua prova", `“${a.title}”: a resposta correta mudou de ${q.answer} para ${answer}. Revise e, se for o caso, reprocesse a correção.`, `/app/provas/${a.id}/correcao`)));
  await audit(ctx.user.id, null, "question.answer_corrected", id, { from: q.answer, to: answer, affected: affected.length });
  revalidatePath("/admin");
  return { ok: `Gabarito retificado. ${affected.length} avaliação(ões) afetada(s); os professores foram avisados e as notas finalizadas só mudam após a revisão deles.` };
}

export async function voidQuestionAction(id: string, voided: boolean) {
  const ctx = await requireStaff();
  await db.update(questions).set({ voided, status: voided ? "blocked" : "in_review" }).where(eq(questions.id, id));
  await db.insert(questionChanges).values({ questionId: id, actorId: ctx.user.id, kind: "status_changed", after: { voided } });
  revalidatePath("/admin");
}

export async function resolveFlagAction(id: string, resolution: "resolved" | "dismissed", _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireStaff();
  await db.update(questionFlags).set({ status: resolution, resolution: String(fd.get("note") ?? "").slice(0, 500) }).where(eq(questionFlags.id, id));
  await audit(ctx.user.id, null, `flag.${resolution}`, id);
  revalidatePath("/admin");
  return { ok: "Ocorrência atualizada." };
}

/** Importação em lote com ficha mínima: itens entram sempre “em curadoria”; liberar é decisão separada. */
export async function importQuestionsAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireStaff();
  let data: unknown;
  try { data = JSON.parse(String(fd.get("json") ?? "")); } catch { return { error: "JSON inválido." }; }
  if (!Array.isArray(data) || !data.length) return { error: "Envie uma lista (array) de questões." };
  if (data.length > 500) return { error: "Máximo de 500 itens por lote." };
  const slugs = new Set(TOPICS.map((t) => t.slug));
  const errors: string[] = []; const rows: (typeof questions.$inferInsert)[] = [];
  data.forEach((r: Record<string, unknown>, i: number) => {
    const need = ["institution", "exam", "year", "title"];
    const miss = need.filter((k) => !r[k]);
    if (miss.length) { errors.push(`Item ${i + 1}: faltam ${miss.join(", ")}.`); return; }
    const assessed = (Array.isArray(r.assessed) ? r.assessed : []).map(String);
    if (assessed.some((s) => !slugs.has(s))) { errors.push(`Item ${i + 1}: tópico desconhecido em “assessed”.`); return; }
    const alternatives = Array.isArray(r.alternatives) ? (r.alternatives as { key: string; text: string }[]) : [];
    const cl = classificar({ subject: r.subject ? String(r.subject) : "interdisciplinar", title: String(r.title), statement: r.statement ? String(r.statement) : null, alternatives });
    rows.push({
      tema: r.tema ? String(r.tema) : cl.tema, series: Array.isArray(r.series) ? r.series.map(String) : cl.series,
      institution: String(r.institution), exam: String(r.exam), year: Number(r.year), phase: r.phase ? String(r.phase) : null, day: r.day ? String(r.day) : null,
      booklet: r.booklet ? String(r.booklet) : null, number: r.number ? Number(r.number) : null, page: r.page ? Number(r.page) : null, sourceUrl: r.sourceUrl ? String(r.sourceUrl) : null,
      title: String(r.title), statement: r.statement ? String(r.statement) : null, alternatives, answer: r.answer ? String(r.answer).toUpperCase() : null, answerSource: r.answerSource ? String(r.answerSource) : null,
      licenseNote: r.licenseNote ? String(r.licenseNote) : null, assessed, prerequisites: (Array.isArray(r.prerequisites) ? r.prerequisites : []).map(String), methods: (Array.isArray(r.methods) ? r.methods : []).map(String),
      searchNorm: searchNormOf({ title: String(r.title), statement: r.statement ? String(r.statement) : null, alternatives, institution: String(r.institution), exam: String(r.exam), year: Number(r.year), extra: cl.tema }),
      difficulty: Number(r.difficulty ?? 3), estSeconds: Number(r.estSeconds ?? 180), stimulusId: r.stimulusId ? String(r.stimulusId) : null, status: "curation", isDemo: false,
    });
  });
  if (errors.length) return { error: errors.slice(0, 5).join(" ") };
  // deduplicação por (instituição, prova, ano, caderno, número) preservando a associação de edição
  const existing = await db.select().from(questions);
  const key = (q: { institution: string; exam: string; year: number; booklet: string | null; number: number | null }) => `${q.institution}|${q.exam}|${q.year}|${q.booklet ?? ""}|${q.number ?? ""}`;
  const seen = new Set(existing.map(key));
  const fresh = rows.filter((r) => { const k = key({ institution: r.institution, exam: r.exam, year: r.year, booklet: r.booklet ?? null, number: r.number ?? null }); if (r.number && seen.has(k)) return false; seen.add(k); return true; });
  if (fresh.length) await db.insert(questions).values(fresh);
  await audit(ctx.user.id, null, "questions.imported", undefined, { inserted: fresh.length, duplicates: rows.length - fresh.length });
  revalidatePath("/admin");
  return { ok: `${fresh.length} item(ns) importado(s) em curadoria; ${rows.length - fresh.length} duplicata(s) reconhecida(s).` };
}

/* ----- Moderação ----- */
export async function moderateAction(flagId: string, action: "hide" | "dismiss" | "block", _: FormState, _fd: FormData): Promise<FormState> {
  const ctx = await requireStaff();
  const [f] = await db.select().from(postFlags).where(eq(postFlags.id, flagId)).limit(1);
  if (!f) return { error: "Denúncia não encontrada." };
  if (action === "hide" || action === "block") {
    if (f.commentId) await db.update(comments).set({ hidden: true }).where(eq(comments.id, f.commentId));
    else if (f.postId) await db.update(posts).set({ hidden: true }).where(eq(posts.id, f.postId));
  }
  if (action === "block") {
    const authorId = f.commentId ? (await db.select({ a: comments.authorId }).from(comments).where(eq(comments.id, f.commentId)).limit(1))[0]?.a : f.postId ? (await db.select({ a: posts.authorId }).from(posts).where(eq(posts.id, f.postId)).limit(1))[0]?.a : null;
    if (authorId) { await db.insert(userBlocks).values({ userId: authorId, reason: f.reason, blockedBy: ctx.user.id }).onConflictDoNothing(); await notify(authorId, "comunidade", "Sua conta foi impedida de publicar", "Você pode recorrer pelo suporte informando o motivo.", "/ajuda#contato"); }
  }
  await db.update(postFlags).set({ status: action === "dismiss" ? "dismissed" : "actioned", action }).where(eq(postFlags.id, flagId));
  await audit(ctx.user.id, null, `moderation.${action}`, flagId);
  revalidatePath("/admin");
  return { ok: "Ação registrada." };
}

export async function unblockUserAction(userId: string) {
  const ctx = await requireStaff();
  await db.delete(userBlocks).where(eq(userBlocks.userId, userId));
  await audit(ctx.user.id, null, "moderation.unblock", userId);
  revalidatePath("/admin");
}

/* ----- Assinaturas e suporte ----- */
export async function setSchoolContractAction(orgId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireStaff();
  const months = Math.max(1, Number(fd.get("months") ?? 12));
  const limits = { assemblies: Number(fd.get("assemblies") || 1000), classes: Number(fd.get("classes") || 200), cards: Number(fd.get("cards") || 20000) };
  const now = new Date();
  await db.update(subscriptions).set({ plan: "school", status: "active", periodStart: now, periodEnd: new Date(now.getTime() + months * 30 * 864e5), limits, provider: "manual", cancelAtPeriodEnd: false, graceUntil: null }).where(eq(subscriptions.orgId, orgId));
  await audit(ctx.user.id, orgId, "billing.contract_set", undefined, { months, limits });
  revalidatePath("/admin");
  return { ok: "Contrato aplicado." };
}

export async function setTicketStatusAction(id: string, status: string) {
  await requireStaff();
  if (!["open", "in_progress", "resolved"].includes(status)) return;
  await db.update(tickets).set({ status }).where(eq(tickets.id, id));
  revalidatePath("/admin");
}

