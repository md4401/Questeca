"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accessInvites, enrollments, studentAccounts, guardianLinks, memberships } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import type { FormState } from "@/components/form";

async function studentInClass(classId: string, studentId: string) {
  const [e] = await db.select().from(enrollments).where(and(eq(enrollments.classId, classId), eq(enrollments.studentId, studentId), eq(enrollments.status, "active"))).limit(1);
  return !!e;
}

/** Gera um link de acesso de uso único (14 dias). O link é mostrado uma vez; só o hash fica guardado. */
export async function createInviteAction(classId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const p = z.object({ studentId: z.string().uuid("Escolha o aluno."), kind: z.enum(["student", "guardian"]), relation: z.string().trim().max(40).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (!(await rateLimit(`access-invite:${ctx.user.id}`, 60, 3600))) return { error: "Muitos convites em pouco tempo. Tente mais tarde." };
  if (!(await studentInClass(cls.id, p.data.studentId))) return { error: "Este aluno não está nesta turma." };
  if (p.data.kind === "student") {
    const [acc] = await db.select().from(studentAccounts).where(eq(studentAccounts.studentId, p.data.studentId)).limit(1);
    if (acc) return { error: "Este aluno já tem conta. Revogue o acesso atual para gerar outro." };
  }
  const token = randomToken(24);
  await db.insert(accessInvites).values({ orgId: cls.orgId, studentId: p.data.studentId, kind: p.data.kind, relation: p.data.relation || null, tokenHash: sha256(token), createdBy: ctx.user.id, expiresAt: new Date(Date.now() + 14 * 864e5) });
  await audit(ctx.user.id, cls.orgId, "access.invite_created", p.data.studentId, { kind: p.data.kind });
  revalidatePath(`/app/turmas/${classId}/acessos`);
  return { ok: `Link de ${p.data.kind === "student" ? "aluno" : "responsável"} (vale 14 dias, uso único): ${env.appUrl()}/acesso/${token}` };
}

export async function revokeInviteAction(classId: string, inviteId: string) {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  await db.update(accessInvites).set({ revokedAt: new Date() }).where(and(eq(accessInvites.id, inviteId), eq(accessInvites.orgId, cls.orgId)));
  await audit(ctx.user.id, cls.orgId, "access.invite_revoked", inviteId);
  revalidatePath(`/app/turmas/${classId}/acessos`);
}

/** Remove o vínculo de uma conta com o estudante; sem mais vínculos, a conta perde o acesso à escola. */
export async function revokeAccessAction(classId: string, kind: "student" | "guardian", userId: string, studentId: string) {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  if (!(await studentInClass(cls.id, studentId))) return;
  if (kind === "student") await db.delete(studentAccounts).where(and(eq(studentAccounts.userId, userId), eq(studentAccounts.studentId, studentId)));
  else await db.delete(guardianLinks).where(and(eq(guardianLinks.userId, userId), eq(guardianLinks.studentId, studentId)));
  const [s1] = await db.select().from(studentAccounts).where(and(eq(studentAccounts.userId, userId), eq(studentAccounts.orgId, cls.orgId))).limit(1);
  const [g1] = await db.select().from(guardianLinks).where(and(eq(guardianLinks.userId, userId), eq(guardianLinks.orgId, cls.orgId))).limit(1);
  if (!s1 && !g1) await db.update(memberships).set({ status: "removed" }).where(and(eq(memberships.userId, userId), eq(memberships.orgId, cls.orgId), eq(memberships.role, kind)));
  await audit(ctx.user.id, cls.orgId, "access.revoked", studentId, { kind, userId });
  revalidatePath(`/app/turmas/${classId}/acessos`);
}
