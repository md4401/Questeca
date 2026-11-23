"use server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { videoLessons, videoViews, enrollments } from "@/db/schema";
import { requireCtx, requireAnyCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { visibleStudents } from "@/lib/portal";
import { validHttpUrl } from "@/lib/core/chat";
import { audit } from "@/lib/audit";
import { awardXp } from "@/lib/gamification";
import { XP_RULES } from "@/lib/core/gamification";
import { classStudents } from "@/lib/access";
import { notifyPortal } from "@/lib/portal-notify";
import type { FormState } from "@/components/form";

export async function createVideoAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const p = z.object({ title: z.string().trim().min(2, "Informe o título.").max(160), description: z.string().trim().max(2000).optional(), url: z.string().trim().max(500), subject: z.string().trim().max(60).optional(), classId: z.string().optional(), thumbnailUrl: z.string().trim().max(500).optional(), durationMin: z.coerce.number().int().min(0).max(600).optional(), tags: z.string().optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (!validHttpUrl(p.data.url)) return { error: "O link do vídeo deve começar com http:// ou https://." };
  if (p.data.thumbnailUrl && !validHttpUrl(p.data.thumbnailUrl)) return { error: "A miniatura deve ser um link http(s)." };
  let classId: string | null = null;
  if (p.data.classId) classId = (await loadClass(ctx, p.data.classId)).cls.id;
  await db.insert(videoLessons).values({ orgId: ctx.org.id, classId, authorId: ctx.user.id, subject: p.data.subject || null, title: p.data.title, description: p.data.description || null, url: p.data.url, thumbnailUrl: p.data.thumbnailUrl || null, durationMin: p.data.durationMin || null, tags: (p.data.tags ?? "").split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 10) });
  revalidatePath("/app/videoaulas");
  return { ok: "Videoaula salva como rascunho. Publique quando quiser." };
}

export async function publishVideoAction(id: string, published: boolean) {
  const ctx = await requireCtx();
  const [v] = await db.select().from(videoLessons).where(and(eq(videoLessons.id, id), eq(videoLessons.orgId, ctx.org.id), eq(videoLessons.authorId, ctx.user.id))).limit(1);
  if (!v) return;
  await db.update(videoLessons).set({ published }).where(eq(videoLessons.id, id));
  if (published && v.classId) { const roster = await classStudents(v.classId); await notifyPortal(roster.map((s) => s.id), "mensagem", `Nova videoaula: ${v.title}`, undefined, `/portal/videoaulas/${id}`, { groupKey: `vid:${id}` }); }
  await audit(ctx.user.id, ctx.org.id, published ? "video.published" : "video.unpublished", id);
  revalidatePath("/app/videoaulas");
}
export async function deleteVideoAction(id: string) {
  const ctx = await requireCtx();
  await db.delete(videoLessons).where(and(eq(videoLessons.id, id), eq(videoLessons.orgId, ctx.org.id), eq(videoLessons.authorId, ctx.user.id)));
  revalidatePath("/app/videoaulas");
}

/** Conta a visualização de quem pode ver a videoaula (uma linha por pessoa; o total soma todas as aberturas). */
export async function registerViewAction(id: string) {
  const ctx = await requireAnyCtx();
  const [v] = await db.select().from(videoLessons).where(and(eq(videoLessons.id, id), eq(videoLessons.orgId, ctx.org.id))).limit(1);
  if (!v || (!v.published && v.authorId !== ctx.user.id)) return;
  if ((ctx.org.role === "student" || ctx.org.role === "guardian") && v.classId) {
    const sids = (await visibleStudents(ctx)).map((s) => s.id);
    const e = sids.length ? await db.select().from(enrollments).where(and(eq(enrollments.classId, v.classId), eq(enrollments.status, "active"))) : [];
    if (!e.some((x) => sids.includes(x.studentId))) return;
  }
  await db.insert(videoViews).values({ videoId: id, userId: ctx.user.id }).onConflictDoUpdate({ target: [videoViews.videoId, videoViews.userId], set: { count: sql`${videoViews.count} + 1`, lastAt: new Date() } });
  await db.update(videoLessons).set({ views: sql`${videoLessons.views} + 1` }).where(eq(videoLessons.id, id));
  if (ctx.org.role === "student") { const [me] = await visibleStudents(ctx); if (me) await awardXp({ orgId: ctx.org.id, studentId: me.id, kind: "study", refKey: `video:${id}`, points: XP_RULES.study, label: `Videoaula assistida: ${v.title}` }); }
}
