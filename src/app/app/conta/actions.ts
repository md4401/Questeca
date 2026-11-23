"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, notifications, tickets } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { hashPassword, verifyPassword, passwordProblem } from "@/lib/crypto";
import { audit, notify } from "@/lib/audit";
import type { FormState } from "@/components/form";

export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Informe seu nome." };
  await db.update(users).set({ name, prefs: { notifyMarketing: fd.get("notifyMarketing") === "on", notifyCommunity: fd.get("notifyCommunity") === "on", largeFont: fd.get("largeFont") === "on" } }).where(eq(users.id, ctx.user.id));
  revalidatePath("/app", "layout");
  return { ok: "Preferências salvas. Avisos de segurança e pagamento são sempre enviados." };
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const cur = String(fd.get("current") ?? ""); const next = String(fd.get("next") ?? "");
  if (!(await verifyPassword(cur, ctx.user.passwordHash))) return { error: "Senha atual incorreta." };
  const prob = passwordProblem(next);
  if (prob) return { error: prob };
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, ctx.user.id));
  await db.delete(sessions).where(and(eq(sessions.userId, ctx.user.id), ne(sessions.id, ctx.sessionId)));
  await audit(ctx.user.id, null, "user.password_changed");
  await notify(ctx.user.id, "seguranca", "Sua senha foi alterada", "As outras sessões foram encerradas.");
  return { ok: "Senha alterada. As outras sessões foram encerradas." };
}

export async function revokeSessionAction(id: string) {
  const ctx = await requireCtx();
  if (id === ctx.sessionId) return;
  await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, ctx.user.id)));
  revalidatePath("/app/conta");
}

export async function markReadAction() {
  const ctx = await requireCtx();
  await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, ctx.user.id));
  revalidatePath("/app", "layout");
}

export async function requestDeletionAction(): Promise<void> {
  const ctx = await requireCtx();
  await db.insert(tickets).values({ userId: ctx.user.id, orgId: ctx.org.id, subject: "Privacidade: solicitação de exclusão de conta", body: "Solicitação de exclusão/exportação de dados pela conta (LGPD)." });
  redirect("/app/conta?ok=" + encodeURIComponent("Solicitação registrada. Responderemos por e-mail."));
}
