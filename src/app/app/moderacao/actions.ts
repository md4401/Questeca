"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { contentReports, classComments, messages, chatBlocks } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { audit } from "@/lib/audit";

async function authorize(reportId: string) {
  const ctx = await requireCtx();
  const [r] = await db.select().from(contentReports).where(and(eq(contentReports.id, reportId), eq(contentReports.orgId, ctx.org.id))).limit(1);
  if (!r) return null;
  if (r.classId) await loadClass(ctx, r.classId); // equipe da turma ou coordenação
  else if (ctx.org.role !== "coordinator" && ctx.org.role !== "admin") return null;
  return { ctx, r };
}

export async function resolveReportAction(reportId: string, action: "remove" | "dismiss" | "block") {
  const a = await authorize(reportId); if (!a) return;
  if (action === "block") {
    // bloqueio institucional do remetente: só coordenação/gestão
    if (a.ctx.org.role !== "coordinator" && a.ctx.org.role !== "admin") return;
    const [sender] = a.r.targetType === "message" ? await db.select({ u: messages.senderId }).from(messages).where(eq(messages.id, a.r.targetId)).limit(1) : await db.select({ u: classComments.authorId }).from(classComments).where(eq(classComments.id, a.r.targetId)).limit(1);
    if (sender) {
      const [ex] = await db.select().from(chatBlocks).where(and(eq(chatBlocks.orgId, a.ctx.org.id), eq(chatBlocks.blockedId, sender.u))).limit(1);
      if (!ex || ex.blockerId !== null) await db.insert(chatBlocks).values({ orgId: a.ctx.org.id, blockerId: null, blockedId: sender.u, createdBy: a.ctx.user.id });
    }
  }
  if (action === "remove" || action === "block") {
    if (a.r.targetType === "comment") await db.update(classComments).set({ deletedAt: new Date() }).where(eq(classComments.id, a.r.targetId));
    else await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, a.r.targetId));
  }
  await db.update(contentReports).set({ status: action === "dismiss" ? "dismissed" : "removed", resolvedBy: a.ctx.user.id, resolvedAt: new Date() }).where(eq(contentReports.id, reportId));
  await audit(a.ctx.user.id, a.ctx.org.id, `report.${action}`, reportId);
  revalidatePath("/app/moderacao");
}
