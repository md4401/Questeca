import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantSessions, assistantMessages } from "@/db/schema";

export const MAX_MSGS_POR_SESSAO = 200;
const UUID = /^[0-9a-f-]{36}$/i;
export const tituloDe = (msg: string) => { const t = msg.replace(/\s+/g, " ").trim(); return t.length > 48 ? `${t.slice(0, 47)}…` : t || "Nova conversa"; };

export async function listarSessoes(userId: string) {
  return db.select({ id: assistantSessions.id, title: assistantSessions.title, updatedAt: assistantSessions.updatedAt }).from(assistantSessions)
    .where(eq(assistantSessions.userId, userId)).orderBy(desc(assistantSessions.updatedAt)).limit(100);
}
export async function sessaoDoUsuario(userId: string, id: string) {
  if (!UUID.test(id)) return null;
  const [s] = await db.select().from(assistantSessions).where(and(eq(assistantSessions.id, id), eq(assistantSessions.userId, userId))).limit(1);
  return s ?? null;
}
export async function criarSessao(userId: string, orgId: string, title = "Nova conversa") {
  const [s] = await db.insert(assistantSessions).values({ userId, orgId, title }).returning();
  return s;
}
export async function mensagensDaSessao(sessionId: string) {
  return db.select({ id: assistantMessages.id, role: assistantMessages.role, content: assistantMessages.content, links: assistantMessages.links, isError: assistantMessages.isError })
    .from(assistantMessages).where(eq(assistantMessages.sessionId, sessionId)).orderBy(asc(assistantMessages.createdAt), asc(assistantMessages.id)).limit(MAX_MSGS_POR_SESSAO);
}
export async function anexar(sessionId: string, m: { role: "user" | "assistant"; content: string; links?: { label: string; href: string }[]; isError?: boolean }) {
  await db.insert(assistantMessages).values({ sessionId, role: m.role, content: m.content, links: m.links ?? [], isError: m.isError ?? false });
  await db.update(assistantSessions).set({ updatedAt: new Date() }).where(eq(assistantSessions.id, sessionId));
}
export async function renomear(userId: string, id: string, title: string) {
  const t = title.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!t) return false;
  const r = await db.update(assistantSessions).set({ title: t }).where(and(eq(assistantSessions.id, id), eq(assistantSessions.userId, userId))).returning({ id: assistantSessions.id });
  return r.length > 0;
}
export async function apagar(userId: string, id: string) {
  const r = await db.delete(assistantSessions).where(and(eq(assistantSessions.id, id), eq(assistantSessions.userId, userId))).returning({ id: assistantSessions.id });
  return r.length > 0;
}
export async function contarMensagens(sessionId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(assistantMessages).where(eq(assistantMessages.sessionId, sessionId));
  return r?.n ?? 0;
}
