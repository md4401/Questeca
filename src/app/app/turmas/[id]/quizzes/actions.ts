"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { quizzes, quizAttempts, type QuizItem } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { parseLocalSP } from "@/lib/task-access";
import { validateQuiz, scoreAttempt } from "@/lib/core/quiz";
import { notifyPortal } from "@/lib/portal-notify";
import { aiAvailable, suggestQuizItems } from "@/lib/ai";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/form";

async function loadQuiz(classId: string, quizId: string) {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  if (!/^[0-9a-f-]{36}$/i.test(quizId)) throw new Error("not found");
  const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, quizId), eq(quizzes.classId, cls.id))).limit(1);
  if (!quiz) throw new Error("not found");
  return { ctx, cls, quiz };
}

function parse(fd: FormData): { error: string } | { v: Omit<typeof quizzes.$inferInsert, "orgId" | "classId" | "ownerId"> } {
  const title = String(fd.get("title") ?? "").trim();
  if (title.length < 2) return { error: "Informe o título do quiz." };
  let items: QuizItem[] = [];
  try { items = JSON.parse(String(fd.get("items") || "[]")); } catch { return { error: "Questões inválidas." }; }
  items = items.slice(0, 60).map((q, i) => ({ id: String(q.id || `q${i + 1}`).slice(0, 24), type: (["mc", "tf", "text", "challenge"].includes(q.type) ? q.type : "mc") as QuizItem["type"], prompt: String(q.prompt ?? "").slice(0, 2000), options: q.type === "mc" ? (q.options ?? []).map((o) => String(o).slice(0, 300)) : undefined, answer: q.type === "text" ? undefined : q.answer, explanation: String(q.explanation ?? "").slice(0, 800) || undefined, points: Number(q.points) || 0 }));
  const dueRaw = String(fd.get("dueAt") ?? ""); const due = dueRaw ? parseLocalSP(dueRaw) : null;
  if (dueRaw && !due) return { error: "Prazo inválido." };
  const limit = Number(fd.get("timeLimitMin") || 0); const attempts = Number(fd.get("maxAttempts") || 1);
  if (limit < 0 || limit > 300) return { error: "Tempo limite inválido (0 a 300 minutos)." };
  if (!(attempts >= 1 && attempts <= 10)) return { error: "Tentativas: de 1 a 10." };
  return { v: { title, description: String(fd.get("description") ?? "").trim().slice(0, 2000) || null, items, dueAt: due, timeLimitMin: limit || null, maxAttempts: attempts, explanations: ["after_submit", "after_due", "never"].includes(String(fd.get("explanations"))) ? String(fd.get("explanations")) : "after_submit", aiGenerated: fd.get("aiGenerated") === "1", reviewed: fd.get("aiGenerated") === "1" ? fd.get("reviewed") === "on" : true } };
}

export async function createQuizAction(classId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const r = parse(fd); if ("error" in r) return r;
  const [q] = await db.insert(quizzes).values({ ...r.v, orgId: cls.orgId, classId: cls.id, ownerId: ctx.user.id }).returning();
  redirect(`/app/turmas/${classId}/quizzes/${q.id}`);
}

export async function updateQuizAction(classId: string, quizId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { quiz } = await loadQuiz(classId, quizId);
  if (quiz.status !== "draft") return { error: "Depois de publicado, o quiz não pode mais ser editado." };
  const r = parse(fd); if ("error" in r) return r;
  await db.update(quizzes).set(r.v).where(eq(quizzes.id, quiz.id));
  revalidatePath(`/app/turmas/${classId}/quizzes/${quizId}`);
  return { ok: "Rascunho salvo." };
}

/** Publicação exige questões válidas e, se geradas por IA, a confirmação de que o professor revisou tudo. */
export async function publishQuizAction(classId: string, quizId: string): Promise<FormState> {
  const { ctx, cls, quiz } = await loadQuiz(classId, quizId);
  if (quiz.status !== "draft") return { error: "Este quiz já foi publicado." };
  const err = validateQuiz(quiz.items); if (err) return { error: err };
  if (quiz.aiGenerated && !quiz.reviewed) return { error: "Há questões sugeridas por IA. Marque que você revisou todas antes de publicar." };
  await db.update(quizzes).set({ status: "published", publishedAt: new Date() }).where(eq(quizzes.id, quiz.id));
  const roster = await classStudents(cls.id);
  await notifyPortal(roster.map((s) => s.id), "tarefa", `Novo quiz: ${quiz.title}`, undefined, `/portal/quizzes/${quiz.id}`, { groupKey: `quiz:${quiz.id}` });
  await audit(ctx.user.id, cls.orgId, "quiz.published", quiz.id);
  revalidatePath(`/app/turmas/${classId}/quizzes/${quizId}`);
  return { ok: "Quiz publicado." };
}

export async function closeQuizAction(classId: string, quizId: string) {
  const { quiz } = await loadQuiz(classId, quizId);
  if (quiz.status === "published") await db.update(quizzes).set({ status: "closed" }).where(eq(quizzes.id, quiz.id));
  revalidatePath(`/app/turmas/${classId}/quizzes/${quizId}`);
}

/** Nota manual das discursivas de uma tentativa. */
export async function gradeAttemptAction(classId: string, quizId: string, attemptId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { quiz } = await loadQuiz(classId, quizId);
  const [at] = await db.select().from(quizAttempts).where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.quizId, quiz.id))).limit(1);
  if (!at || at.status !== "submitted") return { error: "Tentativa não encontrada." };
  const manual: Record<string, number> = {};
  for (const it of quiz.items) if (it.type === "text") {
    const raw = String(fd.get(`m_${it.id}`) ?? "").trim().replace(",", "."); if (raw === "") continue;
    const v = Number(raw); if (Number.isNaN(v) || v < 0 || v > it.points) return { error: `Nota da questão deve estar entre 0 e ${it.points}.` };
    manual[it.id] = v;
  }
  const r = scoreAttempt(quiz.items, at.answers, manual);
  await db.update(quizAttempts).set({ manualScores: manual, score: String(r.score), maxScore: String(r.max), needsReview: r.review }).where(eq(quizAttempts.id, at.id));
  revalidatePath(`/app/turmas/${classId}/quizzes/${quizId}`);
  return { ok: "Correção salva." };
}

export async function suggestQuizAction(topic: string, n: number): Promise<{ items?: QuizItem[]; error?: string }> {
  await requireCtx();
  if (!aiAvailable()) return { error: "A sugestão por IA não está configurada nesta instalação. Monte as questões manualmente." };
  if (topic.trim().length < 3) return { error: "Informe o tema do quiz." };
  try { return { items: await suggestQuizItems(topic, n) }; } catch { return { error: "Não foi possível gerar sugestões agora." }; }
}
