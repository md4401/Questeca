import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, orgs, memberships } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/crypto";
import type { Role } from "@/lib/core/permissions";

const COOKIE = "qs_session";
const DAYS = 30;

export async function createSession(userId: string, activeOrgId?: string | null) {
  const token = randomToken(32);
  const h = await headers();
  await db.insert(sessions).values({
    id: sha256(token), userId, activeOrgId: activeOrgId ?? null,
    userAgent: (h.get("user-agent") ?? "").slice(0, 200),
    expiresAt: new Date(Date.now() + DAYS * 864e5),
  });
  const c = await cookies();
  c.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: DAYS * 86400 });
}

export async function destroySession() {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (t) await db.delete(sessions).where(eq(sessions.id, sha256(t)));
  c.delete(COOKIE);
}

export type Ctx = {
  sessionId: string;
  user: typeof users.$inferSelect;
  orgs: { id: string; name: string; kind: string; role: Role }[];
  org: { id: string; name: string; kind: string; role: Role; settings: typeof orgs.$inferSelect.settings; city: string | null; uf: string | null };
};

export const getSession = cache(async (): Promise<{ sessionId: string; user: typeof users.$inferSelect; activeOrgId: string | null } | null> => {
  const c = await cookies();
  const t = c.get(COOKIE)?.value;
  if (!t) return null;
  const id = sha256(t);
  const rows = await db
    .select({ s: sessions, u: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!rows[0]) return null;
  return { sessionId: id, user: rows[0].u, activeOrgId: rows[0].s.activeOrgId };
});

/** Contexto completo: usuário + escola ativa. Sempre revalida o vínculo (acesso revogado cai na hora). */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const s = await getSession();
  if (!s) return null;
  const list = await db
    .select({ id: orgs.id, name: orgs.name, kind: orgs.kind, role: memberships.role, settings: orgs.settings, city: orgs.city, uf: orgs.uf })
    .from(memberships)
    .innerJoin(orgs, eq(orgs.id, memberships.orgId))
    .where(and(eq(memberships.userId, s.user.id), eq(memberships.status, "active")));
  if (!list.length) return null;
  const active = list.find((o) => o.id === s.activeOrgId) ?? list.find((o) => o.kind === "personal") ?? list[0];
  return {
    sessionId: s.sessionId,
    user: s.user,
    orgs: list.map((o) => ({ id: o.id, name: o.name, kind: o.kind, role: o.role as Role })),
    org: { id: active.id, name: active.name, kind: active.kind, role: active.role as Role, settings: active.settings, city: active.city, uf: active.uf },
  };
});

export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/entrar");
  return ctx;
}

export async function requireStaff() {
  const ctx = await requireCtx();
  if (!ctx.user.isStaff) redirect("/app");
  return ctx;
}

export async function setActiveOrg(sessionId: string, orgId: string) {
  await db.update(sessions).set({ activeOrgId: orgId }).where(eq(sessions.id, sessionId));
}
