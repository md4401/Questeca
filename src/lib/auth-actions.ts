"use server";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, orgs, memberships, authTokens, sessions, invitations, classTeachers, subscriptions } from "@/db/schema";
import { hashPassword, verifyPassword, passwordProblem, sha256 } from "@/lib/crypto";
import { createSession, destroySession, getCtx, getSession } from "@/lib/session";
import { sendMail, layoutMail } from "@/lib/email";
import { loadInvite } from "@/lib/auth-core";
import { env, TERMS_VERSION } from "@/lib/env";
import { rateLimit } from "@/lib/ratelimit";
import { audit, track, notify } from "@/lib/audit";
import type { FormState } from "@/components/form";
import { ip, issueToken, sendVerification } from "@/lib/auth-core";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string(),
  school: z.string().trim().max(160).optional(),
  accept: z.literal("on", { error: "É necessário aceitar os termos e a política de privacidade." }),
  invite: z.string().optional(),
});

export async function signupAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const pw = passwordProblem(d.password);
  if (pw) return { error: pw };
  if (!(await rateLimit(`signup:${await ip()}`, 10, 3600))) return { error: "Muitas tentativas. Tente novamente em instantes." };

  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
  if (exists) return { error: "Já existe uma conta com este e-mail. Entre ou recupere o acesso." };

  const staff = env.staffEmails().includes(d.email);
  const [u] = await db.insert(users).values({
    email: d.email, name: d.name, passwordHash: await hashPassword(d.password),
    termsVersion: TERMS_VERSION, termsAcceptedAt: new Date(), isStaff: staff,
  }).returning();

  const [org] = await db.insert(orgs).values({ name: d.school?.trim() || "Espaço pessoal", kind: "personal", ownerId: u.id }).returning();
  await db.insert(memberships).values({ orgId: org.id, userId: u.id, role: "teacher" });
  const now = new Date();
  await db.insert(subscriptions).values({ orgId: org.id, plan: "free", periodStart: now, periodEnd: new Date(now.getTime() + 365 * 864e5) });
  await sendVerification(u.id, u.email, u.name);
  await audit(u.id, org.id, "user.signup");
  await track("signup", u.id, org.id);
  await createSession(u.id, org.id);
  redirect(d.invite ? `/convite/${d.invite}` : "/app/primeiros-passos");
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = String(fd.get("next") ?? "");
  const generic = { error: "E-mail ou senha incorretos." };
  if (!email || !password) return generic;
  if (!(await rateLimit(`login:${await ip()}:${email}`, 10, 900))) return { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u) { await hashPassword(password); return generic; }
  if (u.lockedUntil && u.lockedUntil > new Date()) return { error: "Acesso temporariamente bloqueado por tentativas incorretas. Tente em 15 minutos ou redefina a senha." };
  if (!(await verifyPassword(password, u.passwordHash))) {
    const fails = u.failedLogins + 1;
    await db.update(users).set({ failedLogins: fails, lockedUntil: fails >= 8 ? new Date(Date.now() + 15 * 60e3) : null }).where(eq(users.id, u.id));
    return generic;
  }
  if (env.requireVerification() && !u.emailVerifiedAt) return { error: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada." };
  await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, u.id));
  const list = await db.select({ orgId: memberships.orgId, kind: orgs.kind }).from(memberships).innerJoin(orgs, eq(orgs.id, memberships.orgId)).where(and(eq(memberships.userId, u.id), eq(memberships.status, "active")));
  // restaura a última escola autorizada
  const [last] = await db.select({ a: sessions.activeOrgId }).from(sessions).where(eq(sessions.userId, u.id)).orderBy(sessions.createdAt).limit(1);
  const active = list.find((o) => o.orgId === last?.a)?.orgId ?? list.find((o) => o.kind === "personal")?.orgId ?? list[0]?.orgId;
  await createSession(u.id, active);
  await audit(u.id, active ?? null, "user.login");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function logoutAllAction() {
  const s = await getSession();
  if (s) await db.delete(sessions).where(eq(sessions.userId, s.user.id));
  await destroySession();
  redirect("/entrar");
}

export async function forgotAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const msg = { ok: "Se existir uma conta com este e-mail, enviamos as instruções. O link vale por 1 hora." };
  if (!email) return { error: "Informe o e-mail." };
  if (!(await rateLimit(`forgot:${await ip()}`, 8, 3600)) || !(await rateLimit(`forgot-mail:${email}`, 3, 3600))) return msg;
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (u) {
    const token = await issueToken(u.id, "reset", 60);
    const href = `${env.appUrl()}/redefinir?token=${token}`;
    await sendMail({ to: u.email, subject: "Redefinição de senha — Questeca", html: layoutMail("Redefinir senha", "<p>Recebemos um pedido para redefinir sua senha. Se não foi você, ignore este e-mail.</p>", { href, label: "Criar nova senha" }), text: `Redefina sua senha: ${href}` });
    await audit(u.id, null, "user.reset_requested");
  }
  return msg;
}

export async function resetAction(_: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const pw = passwordProblem(password);
  if (pw) return { error: pw };
  const [t] = await db.select().from(authTokens).where(and(eq(authTokens.hash, sha256(token)), eq(authTokens.kind, "reset"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).limit(1);
  if (!t) return { error: "Link inválido ou expirado. Peça uma nova redefinição." };
  await db.update(users).set({ passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null }).where(eq(users.id, t.userId));
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, t.id));
  await db.delete(sessions).where(eq(sessions.userId, t.userId)); // invalida sessões abertas
  await audit(t.userId, null, "user.password_reset");
  await notify(t.userId, "seguranca", "Sua senha foi alterada", "Se não foi você, redefina novamente e fale com o suporte.");
  redirect("/entrar?reset=1");
}

export async function resendVerificationAction(): Promise<void> {
  const ctx = await getCtx();
  if (!ctx || ctx.user.emailVerifiedAt) return;
  if (await rateLimit(`resend:${ctx.user.id}`, 3, 3600)) await sendVerification(ctx.user.id, ctx.user.email, ctx.user.name);
}

export async function changeEmailVerificationAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await getCtx();
  if (!ctx) return { error: "Sessão expirada." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) return { error: "E-mail inválido." };
  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (dup) return { error: "Este e-mail já está em uso." };
  const token = await issueToken(ctx.user.id, "verify", 60 * 24, email);
  const href = `${env.appUrl()}/verificar?token=${token}`;
  await sendMail({ to: email, subject: "Confirme o novo e-mail — Questeca", html: layoutMail("Confirme o novo e-mail", "<p>Clique para confirmar a troca de e-mail da sua conta.</p>", { href, label: "Confirmar" }), text: href });
  return { ok: "Enviamos um link de confirmação para o novo endereço. A troca vale após confirmar." };
}

/* ---------- Convites ---------- */
export async function acceptInviteAction(token: string): Promise<FormState> {
  const ctx = await getCtx();
  if (!ctx) redirect(`/entrar?next=/convite/${token}`);
  const loaded = await loadInvite(token);
  if (!loaded || loaded.status !== "pending") return { error: "Este convite não está mais disponível." };
  if (loaded.inv.email.toLowerCase() !== ctx.user.email.toLowerCase()) {
    return { error: `Este convite foi enviado para ${loaded.inv.email}. Entre com esse e-mail para aceitá-lo.` };
  }
  const { inv } = loaded;
  await db.insert(memberships).values({ orgId: inv.orgId, userId: ctx.user.id, role: inv.role }).onConflictDoUpdate({ target: [memberships.orgId, memberships.userId], set: { status: "active", role: inv.role } });
  for (const cid of inv.classIds) await db.insert(classTeachers).values({ classId: cid, userId: ctx.user.id }).onConflictDoNothing();
  await db.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, inv.id));
  await audit(ctx.user.id, inv.orgId, "invite.accepted", inv.id);
  await db.update(sessions).set({ activeOrgId: inv.orgId }).where(eq(sessions.id, ctx.sessionId));
  redirect("/app/primeiros-passos");
}
