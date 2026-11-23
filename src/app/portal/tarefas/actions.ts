"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks, taskSubmissions, submissionVersions, taskAttachments, enrollments, classTeachers } from "@/db/schema";
import { requireAnyCtx } from "@/lib/session";
import { visibleStudents } from "@/lib/portal";
import { canSubmit, autoScore } from "@/lib/core/tasks";
import { MAX_FILE } from "@/lib/task-access";
import { notify, audit, track } from "@/lib/audit";
import type { FormState } from "@/components/form";

/** Entrega do aluno. Responsável só acompanha. O estudante vem da conta, nunca do formulário. */
export async function submitTaskAction(taskId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireAnyCtx();
  if (ctx.org.role !== "student") return { error: "Somente o aluno pode entregar. Responsáveis acompanham a situação." };
  const [me] = await visibleStudents(ctx);
  if (!me || !/^[0-9a-f-]{36}$/i.test(taskId)) return { error: "Tarefa não encontrada." };
  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.orgId, ctx.org.id))).limit(1);
  if (!task) return { error: "Tarefa não encontrada." };
  const [enr] = await db.select().from(enrollments).where(and(eq(enrollments.classId, task.classId), eq(enrollments.studentId, me.id), eq(enrollments.status, "active"))).limit(1);
  if (!enr) return { error: "Tarefa não encontrada." };

  const mode = String(fd.get("mode") ?? "draft");
  let [sub] = await db.select().from(taskSubmissions).where(and(eq(taskSubmissions.taskId, task.id), eq(taskSubmissions.studentId, me.id))).limit(1);
  const now = new Date();
  const can = canSubmit(task, sub ? { status: sub.status, submittedAt: sub.submittedAt, grade: sub.grade } : null, now);
  if (!can.ok) return { error: can.reason };

  const answers: Record<string, string | number> = {};
  for (const q of task.questions) { const v = fd.get(`q_${q.id}`); if (v != null && String(v) !== "") answers[q.id] = q.type === "mc" ? Number(v) : String(v).slice(0, 5000); }
  const answerText = String(fd.get("answerText") ?? "").trim().slice(0, 10000) || null;
  const file = fd.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && file.size > MAX_FILE) return { error: "O arquivo passa de 4 MB." };
  const submit = mode === "submit";
  if (submit && !answerText && !hasFile && Object.keys(answers).length === 0 && task.kind !== "resource") return { error: "Escreva uma resposta, responda às questões ou anexe um arquivo antes de entregar." };
  if (submit && task.questions.some((q) => q.type === "mc") && task.questions.filter((q) => q.type === "mc").some((q) => answers[q.id] == null)) return { error: "Responda todas as questões de múltipla escolha antes de entregar." };

  if (!sub) [sub] = await db.insert(taskSubmissions).values({ taskId: task.id, studentId: me.id }).onConflictDoNothing().returning();
  if (!sub) [sub] = await db.select().from(taskSubmissions).where(and(eq(taskSubmissions.taskId, task.id), eq(taskSubmissions.studentId, me.id))).limit(1);
  if (hasFile) {
    await db.delete(taskAttachments).where(eq(taskAttachments.submissionId, sub.id));
    await db.insert(taskAttachments).values({ orgId: task.orgId, submissionId: sub.id, name: file.name.slice(0, 160), type: file.type || "application/octet-stream", data: Buffer.from(await file.arrayBuffer()) });
  }
  if (!submit) {
    await db.update(taskSubmissions).set({ answerText, answers, status: sub.status === "draft" ? "draft" : sub.status, updatedAt: now }).where(eq(taskSubmissions.id, sub.id));
    revalidatePath(`/portal/tarefas/${task.id}`);
    return { ok: "Rascunho salvo." };
  }
  const version = sub.version + 1;
  const sc = task.questions.length ? autoScore(task.questions, answers) : null;
  const auto = sc && !sc.needsReview;
  await db.update(taskSubmissions).set({
    answerText, answers, version, submittedAt: now, updatedAt: now, autoScore: sc ? String(sc.score) : null,
    status: auto ? "graded" : can.late ? "late" : "submitted",
    ...(auto ? { grade: String(sc.score), feedback: "Correção automática.", gradedAt: now } : { grade: null, gradedAt: null, gradedBy: null }),
  }).where(eq(taskSubmissions.id, sub.id));
  await db.insert(submissionVersions).values({ submissionId: sub.id, version, answerText, answers, late: can.late, submittedAt: now });
  const teachers = await db.select({ u: classTeachers.userId }).from(classTeachers).where(eq(classTeachers.classId, task.classId));
  await Promise.all(teachers.map((t) => notify(t.u, "tarefa", `Nova entrega: ${task.title}`, undefined, `/app/turmas/${task.classId}/tarefas/${task.id}`, { groupKey: `sub:${task.id}` })));
  await audit(ctx.user.id, task.orgId, "task.submitted", sub.id, { late: can.late, version });
  await track("task_submitted", ctx.user.id, task.orgId);
  revalidatePath(`/portal/tarefas/${task.id}`); revalidatePath("/portal/tarefas");
  return { ok: auto ? `Entregue e corrigida automaticamente: ${String(sc.score).replace(".", ",")} ponto(s).` : can.late ? "Entregue com atraso." : "Tarefa entregue." };
}
