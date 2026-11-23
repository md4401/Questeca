"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tasks, taskSubmissions, taskAttachments, gradeItems } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { loadTaskForStaff, parseLocalSP, MAX_FILE } from "@/lib/task-access";
import { validateQuestions } from "@/lib/core/tasks";
import { notifyPortal } from "@/lib/portal-notify";
import { audit, track } from "@/lib/audit";
import { rulesFrom } from "@/lib/gradebook";
import { saveGrade } from "@/app/app/turmas/actions";
import type { TaskQuestion } from "@/db/schema";
import type { FormState } from "@/components/form";

const base = z.object({
  title: z.string().trim().min(2, "Informe o título da tarefa.").max(160),
  description: z.string().trim().max(5000).optional(),
  kind: z.enum(["assignment", "form", "resource"]),
  dueAt: z.string().optional(), points: z.coerce.number().min(0, "Pontuação inválida.").max(1000).default(10),
  resourceUrl: z.string().trim().max(500).optional(), questions: z.string().optional(),
});

function parseForm(fd: FormData): { error: string } | { data: z.infer<typeof base>; due: Date | null; qs: TaskQuestion[]; allowLate: boolean; allowResubmit: boolean } {
  const p = base.safeParse({ ...Object.fromEntries(fd), points: String(fd.get("points") ?? "10").replace(",", ".") });
  if (!p.success) return { error: p.error.issues[0].message };
  let qs: TaskQuestion[] = [];
  try { qs = JSON.parse(p.data.questions || "[]"); } catch { return { error: "Questões inválidas." }; }
  qs = qs.slice(0, 50).map((q, i) => ({ id: String(q.id || `q${i + 1}`).slice(0, 20), type: q.type === "mc" ? "mc" : "text", prompt: String(q.prompt ?? "").slice(0, 2000), options: q.type === "mc" ? (q.options ?? []).map((o) => String(o).slice(0, 300)) : undefined, answer: q.type === "mc" ? Number(q.answer) : undefined, points: Number(q.points) || 0 }));
  const qErr = validateQuestions(qs); if (qErr) return { error: qErr };
  if (p.data.resourceUrl && !/^https?:\/\//i.test(p.data.resourceUrl)) return { error: "O link do recurso deve começar com http:// ou https://." };
  const due = p.data.dueAt ? parseLocalSP(p.data.dueAt) : null;
  if (p.data.dueAt && !due) return { error: "Prazo inválido." };
  return { data: p.data, due, qs, allowLate: fd.get("allowLate") === "on", allowResubmit: fd.get("allowResubmit") === "on" };
}

export async function createTaskAction(classId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const r = parseForm(fd); if ("error" in r) return r;
  const points = r.qs.length ? r.qs.reduce((s, q) => s + q.points, 0) : r.data.points;
  const [t] = await db.insert(tasks).values({ orgId: cls.orgId, classId: cls.id, ownerId: ctx.user.id, kind: r.data.kind, title: r.data.title, description: r.data.description || null, dueAt: r.due, points: String(points), allowLate: r.allowLate, allowResubmit: r.allowResubmit, questions: r.qs, resourceUrl: r.data.resourceUrl || null }).returning();
  await audit(ctx.user.id, cls.orgId, "task.created", t.id);
  redirect(`/app/turmas/${classId}/tarefas/${t.id}`);
}

export async function updateTaskAction(classId: string, taskId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { task } = await loadTaskForStaff(ctx, classId, taskId);
  if (task.status !== "draft") return { error: "Depois de publicada, só o prazo pode ser alterado." };
  const r = parseForm(fd); if ("error" in r) return r;
  const points = r.qs.length ? r.qs.reduce((s, q) => s + q.points, 0) : r.data.points;
  await db.update(tasks).set({ kind: r.data.kind, title: r.data.title, description: r.data.description || null, dueAt: r.due, points: String(points), allowLate: r.allowLate, allowResubmit: r.allowResubmit, questions: r.qs, resourceUrl: r.data.resourceUrl || null }).where(eq(tasks.id, task.id));
  revalidatePath(`/app/turmas/${classId}/tarefas/${taskId}`);
  return { ok: "Rascunho salvo." };
}

export async function publishTaskAction(classId: string, taskId: string) {
  const ctx = await requireCtx();
  const { cls, task } = await loadTaskForStaff(ctx, classId, taskId);
  if (task.status !== "draft") return;
  const roster = await classStudents(cls.id);
  await db.update(tasks).set({ status: "published", publishedAt: new Date() }).where(eq(tasks.id, task.id));
  await notifyPortal(roster.map((s) => s.id), "tarefa", `Nova tarefa: ${task.title}`, task.dueAt ? undefined : undefined, `/portal/tarefas/${task.id}`, { groupKey: `task:${task.id}` });
  await audit(ctx.user.id, cls.orgId, "task.published", task.id);
  await track("task_published", ctx.user.id, cls.orgId);
  revalidatePath(`/app/turmas/${classId}/tarefas/${taskId}`);
}

export async function closeTaskAction(classId: string, taskId: string) {
  const ctx = await requireCtx();
  const { task } = await loadTaskForStaff(ctx, classId, taskId);
  if (task.status === "published") await db.update(tasks).set({ status: "closed" }).where(eq(tasks.id, task.id));
  revalidatePath(`/app/turmas/${classId}/tarefas/${taskId}`);
}

export async function extendDueAction(classId: string, taskId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls, task } = await loadTaskForStaff(ctx, classId, taskId);
  const due = parseLocalSP(String(fd.get("dueAt") ?? "")); if (!due) return { error: "Prazo inválido." };
  await db.update(tasks).set({ dueAt: due, status: task.status === "closed" ? "published" : task.status }).where(eq(tasks.id, task.id));
  if (task.status !== "draft") { const roster = await classStudents(cls.id); await notifyPortal(roster.map((s) => s.id), "tarefa", `Novo prazo: ${task.title}`, undefined, `/portal/tarefas/${task.id}`, { groupKey: `taskdue:${task.id}` }); }
  revalidatePath(`/app/turmas/${classId}/tarefas/${taskId}`);
  return { ok: "Prazo atualizado." };
}

export async function uploadTaskFileAction(classId: string, taskId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls, task } = await loadTaskForStaff(ctx, classId, taskId);
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return { error: "Escolha um arquivo." };
  if (f.size > MAX_FILE) return { error: "O arquivo passa de 4 MB." };
  await db.insert(taskAttachments).values({ orgId: cls.orgId, taskId: task.id, name: f.name.slice(0, 160), type: f.type || "application/octet-stream", data: Buffer.from(await f.arrayBuffer()) });
  revalidatePath(`/app/turmas/${classId}/tarefas/${taskId}`);
  return { ok: "Arquivo anexado." };
}

export async function deleteAttachmentAction(classId: string, taskId: string, attId: string) {
  const ctx = await requireCtx();
  const { task } = await loadTaskForStaff(ctx, classId, taskId);
  await db.delete(taskAttachments).where(and(eq(taskAttachments.id, attId), eq(taskAttachments.taskId, task.id)));
  revalidatePath(`/app/turmas/${classId}/tarefas/${taskId}`);
}

/** Nota e devolutiva de uma entrega. O aluno só vê depois de corrigida. */
export async function gradeSubmissionAction(classId: string, taskId: string, studentId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls, task } = await loadTaskForStaff(ctx, classId, taskId);
  const raw = String(fd.get("grade") ?? "").trim().replace(",", ".");
  const grade = Number(raw);
  if (raw === "" || Number.isNaN(grade) || grade < 0 || grade > Number(task.points)) return { error: `A nota deve estar entre 0 e ${String(Number(task.points)).replace(".", ",")}.` };
  const [sub] = await db.select().from(taskSubmissions).where(and(eq(taskSubmissions.taskId, task.id), eq(taskSubmissions.studentId, studentId))).limit(1);
  if (!sub || sub.status === "draft") return { error: "Este aluno ainda não entregou." };
  await db.update(taskSubmissions).set({ grade: String(grade), feedback: String(fd.get("feedback") ?? "").trim().slice(0, 3000) || null, status: "graded", gradedAt: new Date(), gradedBy: ctx.user.id, updatedAt: new Date() }).where(eq(taskSubmissions.id, sub.id));
  await notifyPortal([studentId], "nota", `Tarefa corrigida: ${task.title}`, undefined, `/portal/tarefas/${task.id}`, { groupKey: `graded:${task.id}:${studentId}` });
  await audit(ctx.user.id, cls.orgId, "task.graded", sub.id);
  revalidatePath(`/app/turmas/${classId}/tarefas/${taskId}`);
  return { ok: "Correção salva." };
}

/** Lança as notas da tarefa no caderno. Só entra o que o professor confirmou; sem entrega só vira "N" com a tarefa encerrada. */
export async function launchGradesAction(classId: string, taskId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls, task } = await loadTaskForStaff(ctx, classId, taskId);
  const period = String(fd.get("period") ?? "");
  if (!rulesFrom(ctx.org.settings).periods.includes(period)) return { error: "Escolha o período." };
  let itemId = task.gradeItemId;
  if (!itemId) {
    const [gi] = await db.insert(gradeItems).values({ classId: cls.id, title: task.title, category: "tarefa", period, weight: "1", maxPoints: String(Number(task.points)) }).returning();
    itemId = gi.id; await db.update(tasks).set({ gradeItemId: gi.id }).where(eq(tasks.id, task.id));
  }
  const subs = await db.select().from(taskSubmissions).where(eq(taskSubmissions.taskId, task.id));
  const roster = await classStudents(cls.id);
  let n = 0; let skipped = 0;
  for (const s of roster) {
    const sub = subs.find((x) => x.studentId === s.id);
    let raw = "";
    if (sub?.status === "graded" && sub.grade != null) raw = String(Number(sub.grade)).replace(".", ",");
    else if (!sub && task.status === "closed") raw = "N";
    if (!raw) { skipped++; continue; }
    const r = await saveGrade(cls.id, itemId, s.id, raw, { source: "task", reason: `Tarefa: ${task.title}` });
    if ("error" in r && r.error) return { error: r.error }; n++;
  }
  revalidatePath(`/app/turmas/${classId}/tarefas/${taskId}`);
  return { ok: `${n} nota(s) lançada(s) no caderno; ${skipped} ficaram pendentes (sem correção ou tarefa ainda aberta).` };
}
