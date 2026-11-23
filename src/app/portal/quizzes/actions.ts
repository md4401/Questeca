"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { quizzes, quizAttempts, enrollments } from "@/db/schema";
import { requireAnyCtx } from "@/lib/session";
import { visibleStudents } from "@/lib/portal";
import { canStart, scoreAttempt, withinTime } from "@/lib/core/quiz";
import { awardXp } from "@/lib/gamification";
import { XP_RULES, quizXp } from "@/lib/core/gamification";
import { notify } from "@/lib/audit";
import { classTeachers } from "@/db/schema";
import type { FormState } from "@/components/form";

async function me() {
  const ctx = await requireAnyCtx();
  if (ctx.org.role !== "student") return null;
  const [st] = await visibleStudents(ctx);
  return st ? { ctx, st } : null;
}

/** Inicia (ou retoma) uma tentativa. O relógio do quiz é do servidor: o prazo é gravado no início. */
export async function startQuizAction(quizId: string) {
  const m = await me(); if (!m) return;
  const [q] = await db.select().from(quizzes).where(and(eq(quizzes.id, quizId), eq(quizzes.orgId, m.ctx.org.id))).limit(1);
  if (!q) return;
  const [enr] = await db.select().from(enrollments).where(and(eq(enrollments.classId, q.classId), eq(enrollments.studentId, m.st.id), eq(enrollments.status, "active"))).limit(1);
  if (!enr) return;
  const now = new Date();
  let attempts = await db.select().from(quizAttempts).where(and(eq(quizAttempts.quizId, q.id), eq(quizAttempts.studentId, m.st.id)));
  // tentativa em andamento cujo tempo acabou vira "tempo esgotado" (conta como tentativa usada)
  for (const a of attempts) if (a.status === "in_progress" && a.deadlineAt && a.deadlineAt.getTime() + 15000 < now.getTime()) { await db.update(quizAttempts).set({ status: "expired" }).where(eq(quizAttempts.id, a.id)); a.status = "expired"; }
  const chk = canStart(q, attempts.map((a) => ({ attemptNo: a.attemptNo, status: a.status, deadlineAt: a.deadlineAt })), now);
  if (chk.ok && !chk.resume) {
    await db.insert(quizAttempts).values({ quizId: q.id, studentId: m.st.id, attemptNo: chk.attemptNo, deadlineAt: q.timeLimitMin ? new Date(now.getTime() + q.timeLimitMin * 60e3) : null }).onConflictDoNothing();
  }
  attempts = [];
  revalidatePath(`/portal/quizzes/${quizId}`);
  redirect(`/portal/quizzes/${quizId}`);
}

export async function submitQuizAction(attemptId: string, _: FormState, fd: FormData): Promise<FormState> {
  const m = await me(); if (!m) return { error: "Somente o aluno responde ao quiz." };
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return { error: "Tentativa não encontrada." };
  const [at] = await db.select().from(quizAttempts).where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.studentId, m.st.id))).limit(1);
  if (!at || at.status !== "in_progress") return { error: "Esta tentativa já foi encerrada." };
  const [q] = await db.select().from(quizzes).where(eq(quizzes.id, at.quizId)).limit(1);
  if (!q || q.orgId !== m.ctx.org.id) return { error: "Quiz não encontrado." };
  const now = new Date();
  if (!withinTime(at.deadlineAt, now)) {
    await db.update(quizAttempts).set({ status: "expired", submittedAt: now }).where(eq(quizAttempts.id, at.id));
    revalidatePath(`/portal/quizzes/${q.id}`);
    return { error: "O tempo acabou antes do envio. A tentativa foi encerrada." };
  }
  const answers: Record<string, string | number | boolean> = {};
  for (const it of q.items) {
    const v = fd.get(`q_${it.id}`); if (v == null || String(v) === "") continue;
    answers[it.id] = it.type === "mc" ? Number(v) : it.type === "tf" ? String(v) === "true" : String(v).slice(0, 5000);
  }
  const r = scoreAttempt(q.items, answers);
  const done = await db.update(quizAttempts).set({ status: "submitted", submittedAt: now, answers, score: String(r.score), maxScore: String(r.max), needsReview: r.review }).where(and(eq(quizAttempts.id, at.id), eq(quizAttempts.status, "in_progress"))).returning({ id: quizAttempts.id });
  if (!done.length) return { error: "Esta tentativa já foi enviada." };
  await awardXp({ orgId: q.orgId, studentId: m.st.id, kind: "quiz_done", refKey: `quiz:${q.id}`, points: quizXp(r.pct) - (r.pct >= 100 ? XP_RULES.quiz_perfect : 0), label: `Quiz concluído: ${q.title}` });
  if (r.pct >= 100 && !r.review) await awardXp({ orgId: q.orgId, studentId: m.st.id, kind: "quiz_perfect", refKey: `quizperfect:${q.id}`, points: XP_RULES.quiz_perfect, label: `Quiz com nota máxima: ${q.title}` });
  const teachers = await db.select({ u: classTeachers.userId }).from(classTeachers).where(eq(classTeachers.classId, q.classId));
  await Promise.all(teachers.map((t) => notify(t.u, "tarefa", `Quiz respondido: ${q.title}`, undefined, `/app/turmas/${q.classId}/quizzes/${q.id}`, { groupKey: `quizdone:${q.id}` })));
  revalidatePath(`/portal/quizzes/${q.id}`);
  return { ok: "Quiz enviado." };
}
