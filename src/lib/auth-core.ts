import "server-only";
import { headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, orgs, authTokens, invitations } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendMail, layoutMail } from "@/lib/email";
import { env } from "@/lib/env";

export async function ip() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function issueToken(userId: string, kind: "verify" | "reset", ttlMin: number, payload?: string) {
  const token = randomToken(32);
  await db.insert(authTokens).values({ userId, kind, hash: sha256(token), payload, expiresAt: new Date(Date.now() + ttlMin * 60e3) });
  return token;
}

export async function sendVerification(userId: string, email: string, name: string) {
  const token = await issueToken(userId, "verify", 60 * 24 * 3);
  const href = `${env.appUrl()}/verificar?token=${token}`;
  await sendMail({ to: email, subject: "Confirme seu e-mail na Questeca", html: layoutMail("Confirme seu e-mail", `<p>Olá, ${escapeHtml(name)}! Falta só confirmar o endereço para ativar sua conta.</p>`, { href, label: "Confirmar e-mail" }), text: `Confirme seu e-mail: ${href}` });
}

export async function verifyEmailToken(token: string) {
  const [t] = await db.select().from(authTokens).where(and(eq(authTokens.hash, sha256(token)), eq(authTokens.kind, "verify"), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date()))).limit(1);
  if (!t) return false;
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, t.id));
  if (t.payload) await db.update(users).set({ email: t.payload, emailVerifiedAt: new Date() }).where(eq(users.id, t.userId));
  else await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, t.userId));
  return true;
}

export async function loadInvite(token: string) {
  const [inv] = await db.select().from(invitations).where(eq(invitations.tokenHash, sha256(token))).limit(1);
  if (!inv) return null;
  const [org] = await db.select().from(orgs).where(eq(orgs.id, inv.orgId)).limit(1);
  let status: string = inv.status;
  if (status === "pending" && inv.expiresAt < new Date()) status = "expired";
  return { inv, org, status };
}
