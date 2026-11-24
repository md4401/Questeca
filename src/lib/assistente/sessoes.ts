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
  return db.select({ id: assistantMessages.id, role: assistantMessages.role, content: assistantMessages.content, links: assistantMessages.links, isError: assistantMessages.isError, attachments: assistantMessages.attachments })
    .from(assistantMessages).where(eq(assistantMessages.sessionId, sessionId)).orderBy(asc(assistantMessages.createdAt), asc(assistantMessages.id)).limit(MAX_MSGS_POR_SESSAO);
}
export type Anexo = { name: string; mime: string; size: number; text: string };
/** Grava uma mensagem e devolve o id (o cliente usa para editar depois). */
export async function anexar(sessionId: string, m: { role: "user" | "assistant"; content: string; links?: { label: string; href: string }[]; isError?: boolean; attachments?: Anexo[] }) {
  const [r] = await db.insert(assistantMessages).values({ sessionId, role: m.role, content: m.content, links: m.links ?? [], isError: m.isError ?? false, attachments: m.attachments ?? [] }).returning({ id: assistantMessages.id });
  await db.update(assistantSessions).set({ updatedAt: new Date() }).where(eq(assistantSessions.id, sessionId));
  return r.id;
}
/** Editar uma mensagem do professor: apaga ela e tudo que veio depois (a conversa recomeça dali). Devolve os anexos que ela tinha (ou null se não for uma mensagem do professor desta conversa). */
export async function apagarAPartirDe(sessionId: string, messageId: string): Promise<{ anexos: Anexo[] } | null> {
  if (!UUID.test(messageId)) return null;
  const [m] = await db.select().from(assistantMessages).where(and(eq(assistantMessages.id, messageId), eq(assistantMessages.sessionId, sessionId))).limit(1);
  if (!m || m.role !== "user") return null;
  await db.delete(assistantMessages).where(and(eq(assistantMessages.sessionId, sessionId), sql`(${assistantMessages.createdAt}, ${assistantMessages.id}) >= (${m.createdAt}, ${m.id})`));
  return { anexos: m.attachments ?? [] };
}
/** Para a tela: mensagens sem o texto extraído dos anexos (só nome, tipo e tamanho). */
export const paraTela = <T extends { attachments?: Anexo[] }>(m: T) => ({ ...m, attachments: (m.attachments ?? []).map(({ name, mime, size }) => ({ name, mime, size })) });

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
