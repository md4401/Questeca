"use server";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accessInvites, users, memberships, studentAccounts, guardianLinks } from "@/db/schema";
import { hashPassword, passwordProblem, sha256 } from "@/lib/crypto";
import { createSession, getCtx } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { ip } from "@/lib/auth-core";
import { audit, track } from "@/lib/audit";
import { TERMS_VERSION } from "@/lib/env";
import type { FormState } from "@/components/form";

export async function loadAccessInvite(token: string) {
  const [inv] = await db.select().from(accessInvites).where(and(eq(accessInvites.tokenHash, sha256(token)), isNull(accessInvites.usedAt), isNull(accessInvites.revokedAt), gt(accessInvites.expiresAt, new Date()))).limit(1);
  return inv ?? null;
}

/** Cria a conta (ou usa a conta logada) e vincula ao estudante do convite. Convite de uso único. */
export async function redeemAccessAction(token: string, _: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit(`access-redeem:${await ip()}`, 20, 3600))) return { error: "Muitas tentativas. Tente novamente em instantes." };
  const inv = await loadAccessInvite(token);
  if (!inv) return { error: "Este link não está mais disponível. Peça um novo à escola." };
  const logged = await getCtx();
  let userId: string;
  if (logged) {
    userId = logged.user.id;
  } else {
    const p = z.object({ name: z.string().trim().min(2, "Informe seu nome.").max(120), email: z.string().trim().toLowerCase().email("E-mail inválido."), password: z.string(), accept: z.literal("on", { error: "É necessário aceitar os termos e a política de privacidade." }) }).safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: p.error.issues[0].message };
    const pw = passwordProblem(p.data.password); if (pw) return { error: pw };
    const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, p.data.email)).limit(1);
    if (dup) return { error: "Já existe uma conta com este e-mail. Entre nela e abra o link novamente." };
    const [u] = await db.insert(users).values({ email: p.data.email, name: p.data.name, passwordHash: await hashPassword(p.data.password), termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() }).returning();
    userId = u.id;
  }
  // um usuário não pode acumular papéis diferentes na mesma escola
  const [m] = await db.select().from(memberships).where(and(eq(memberships.orgId, inv.orgId), eq(memberships.userId, userId))).limit(1);
  if (m && m.status === "active" && m.role !== inv.kind) return { error: "Esta conta já tem outro papel nesta escola. Use outro e-mail." };
  if (inv.kind === "student") {
    const [acc] = await db.select().from(studentAccounts).where(eq(studentAccounts.studentId, inv.studentId)).limit(1);
    if (acc) return { error: "Este aluno já tem conta." };
  }
  // consome o convite de forma atômica: só um resgate vence
  const used = await db.update(accessInvites).set({ usedAt: new Date(), usedBy: userId }).where(and(eq(accessInvites.id, inv.id), isNull(accessInvites.usedAt), isNull(accessInvites.revokedAt))).returning({ id: accessInvites.id });
  if (!used.length) return { error: "Este link já foi usado." };
  await db.insert(memberships).values({ orgId: inv.orgId, userId, role: inv.kind }).onConflictDoUpdate({ target: [memberships.orgId, memberships.userId], set: { status: "active", role: inv.kind } });
  if (inv.kind === "student") await db.insert(studentAccounts).values({ userId, studentId: inv.studentId, orgId: inv.orgId });
  else await db.insert(guardianLinks).values({ userId, studentId: inv.studentId, orgId: inv.orgId, relation: inv.relation }).onConflictDoNothing();
  await audit(userId, inv.orgId, "access.redeemed", inv.studentId, { kind: inv.kind });
  await track("portal_signup", userId, inv.orgId, { kind: inv.kind });
  await createSession(userId, inv.orgId);
  redirect("/portal");
}
