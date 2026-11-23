"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { classPosts, classComments, taskAttachments, enrollments, classTeachers, contentReports } from "@/db/schema";
import { requireAnyCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { visibleStudents } from "@/lib/portal";
import { notifyPortal } from "@/lib/portal-notify";
import { notify, audit } from "@/lib/audit";
import { isPortalRole } from "@/lib/core/permissions";
import { validHttpUrl } from "@/lib/core/chat";
import { MAX_FILE } from "@/lib/task-access";
import { awardXp } from "@/lib/gamification";
import { XP_RULES, PARTICIPATION_DAILY_CAP } from "@/lib/core/gamification";
import { xpEvents } from "@/db/schema";
import { todayISO } from "@/lib/format";
import type { FormState } from "@/components/form";

const BLOCKED_TYPES = ["text/html", "image/svg+xml", "application/xhtml+xml", "text/javascript"];

async function staffClass(classId: string) {
  const ctx = await requireAnyCtx();
  if (isPortalRole(ctx.org.role)) throw new Error("forbidden");
  return { ctx, ...(await loadClass(ctx, classId)) };
}

/** Publicação do mural da turma: só a equipe da turma. O público é a turma (alunos e responsáveis). */
export async function createPostAction(classId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { ctx, cls } = await staffClass(classId);
  const p = z.object({ kind: z.enum(["aviso", "atividade", "recurso", "formulario"]), title: z.string().trim().max(160).optional(), body: z.string().trim().min(2, "Escreva a publicação.").max(5000), linkUrl: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.linkUrl && !validHttpUrl(p.data.linkUrl)) return { error: "O link deve começar com http:// ou https://." };
  const f = fd.get("file");
  const hasFile = f instanceof File && f.size > 0;
  if (hasFile && f.size > MAX_FILE) return { error: "O arquivo passa de 4 MB." };
  if (hasFile && BLOCKED_TYPES.includes(f.type)) return { error: "Tipo de arquivo não permitido." };
  const [post] = await db.insert(classPosts).values({ orgId: cls.orgId, classId: cls.id, authorId: ctx.user.id, kind: p.data.kind, title: p.data.title || null, body: p.data.body, linkUrl: p.data.linkUrl || null }).returning();
  if (hasFile) await db.insert(taskAttachments).values({ orgId: cls.orgId, postId: post.id, name: f.name.slice(0, 160), type: f.type || "application/octet-stream", data: Buffer.from(await f.arrayBuffer()) });
  const roster = await classStudents(cls.id);
  await notifyPortal(roster.map((s) => s.id), "mensagem", `Mural ${cls.name}: ${p.data.title || p.data.body.slice(0, 60)}`, undefined, "/portal/mural", { groupKey: `post:${cls.id}` });
  await audit(ctx.user.id, cls.orgId, "post.created", post.id);
  revalidatePath(`/app/turmas/${classId}/mural`);
  return { ok: "Publicado para a turma." };
}

export async function pinPostAction(classId: string, postId: string, pinned: boolean) {
  const { cls } = await staffClass(classId);
  await db.update(classPosts).set({ pinned }).where(and(eq(classPosts.id, postId), eq(classPosts.classId, cls.id)));
  revalidatePath(`/app/turmas/${classId}/mural`);
}
export async function deletePostAction(classId: string, postId: string) {
  const { ctx, cls } = await staffClass(classId);
  await db.delete(classPosts).where(and(eq(classPosts.id, postId), eq(classPosts.classId, cls.id)));
  await audit(ctx.user.id, cls.orgId, "post.deleted", postId);
  revalidatePath(`/app/turmas/${classId}/mural`);
}

/** Quem pode comentar: equipe da turma e alunos matriculados. Responsável acompanha, não comenta. */
async function commenterFor(postId: string) {
  const ctx = await requireAnyCtx();
  const [post] = await db.select().from(classPosts).where(and(eq(classPosts.id, postId), eq(classPosts.orgId, ctx.org.id))).limit(1);
  if (!post) return null;
  if (ctx.org.role === "student") {
    const [me] = await visibleStudents(ctx);
    const [e] = me ? await db.select().from(enrollments).where(and(eq(enrollments.classId, post.classId), eq(enrollments.studentId, me.id), eq(enrollments.status, "active"))).limit(1) : [];
    return e ? { ctx, post, kind: "student" as const } : null;
  }
  if (ctx.org.role === "guardian") return null;
  try { await loadClass(ctx, post.classId); } catch { return null; }
  return { ctx, post, kind: "staff" as const };
}

export async function commentAction(postId: string, _: FormState, fd: FormData): Promise<FormState> {
  const c = await commenterFor(postId);
  if (!c) return { error: "Você não pode comentar aqui. Responsáveis acompanham o mural." };
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 1) return { error: "Escreva o comentário." };
  if (body.length > 1000) return { error: "O comentário passa de 1000 caracteres." };
  const parentId = String(fd.get("parentId") ?? "") || null;
  await db.insert(classComments).values({ postId, authorId: c.ctx.user.id, parentId, body });
  const teachers = await db.select({ u: classTeachers.userId }).from(classTeachers).where(eq(classTeachers.classId, c.post.classId));
  if (c.kind === "student") {
    const [me] = await visibleStudents(c.ctx);
    if (me) { const today = todayISO(); const done = await db.select({ id: xpEvents.id }).from(xpEvents).where(and(eq(xpEvents.studentId, me.id), eq(xpEvents.kind, "participation"), eq(xpEvents.day, today))); if (done.length < PARTICIPATION_DAILY_CAP) await awardXp({ orgId: c.ctx.org.id, studentId: me.id, kind: "participation", refKey: `part:${today}:${done.length + 1}`, points: XP_RULES.participation, label: "Participação no mural" }); }
  }
  if (c.kind === "student") await Promise.all(teachers.filter((t) => t.u !== c.ctx.user.id).map((t) => notify(t.u, "mensagem", "Novo comentário no mural", undefined, `/app/turmas/${c.post.classId}/mural`, { groupKey: `cmt:${postId}` })));
  revalidatePath(`/app/turmas/${c.post.classId}/mural`); revalidatePath("/portal/mural");
  return { ok: "Comentário enviado." };
}

export async function deleteCommentAction(commentId: string) {
  const ctx = await requireAnyCtx();
  const [cm] = await db.select().from(classComments).where(eq(classComments.id, commentId)).limit(1);
  if (!cm) return;
  const [post] = await db.select().from(classPosts).where(and(eq(classPosts.id, cm.postId), eq(classPosts.orgId, ctx.org.id))).limit(1);
  if (!post) return;
  let allowed = cm.authorId === ctx.user.id;
  if (!allowed && !isPortalRole(ctx.org.role)) { try { await loadClass(ctx, post.classId); allowed = true; } catch { /* sem acesso */ } }
  if (!allowed) return;
  await db.update(classComments).set({ deletedAt: new Date() }).where(eq(classComments.id, commentId));
  await audit(ctx.user.id, ctx.org.id, "comment.deleted", commentId);
  revalidatePath(`/app/turmas/${post.classId}/mural`); revalidatePath("/portal/mural");
}

/** Denúncia de comentário: vai para a fila de moderação da escola e avisa a equipe da turma. */
export async function reportCommentAction(commentId: string) {
  const ctx = await requireAnyCtx();
  const [cm] = await db.select().from(classComments).where(eq(classComments.id, commentId)).limit(1);
  if (!cm) return;
  const [post] = await db.select().from(classPosts).where(and(eq(classPosts.id, cm.postId), eq(classPosts.orgId, ctx.org.id))).limit(1);
  if (!post) return;
  await db.insert(contentReports).values({ orgId: ctx.org.id, classId: post.classId, targetType: "comment", targetId: commentId, reporterId: ctx.user.id }).onConflictDoNothing();
  const teachers = await db.select({ u: classTeachers.userId }).from(classTeachers).where(eq(classTeachers.classId, post.classId));
  await Promise.all(teachers.map((t) => notify(t.u, "sistema", "Comentário denunciado no mural", undefined, "/app/moderacao", { groupKey: `rep:${post.classId}`, priority: "high" })));
  revalidatePath("/portal/mural");
}
