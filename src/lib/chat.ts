import "server-only";
import { and, eq, inArray, isNull, gt, ne, sql, count } from "drizzle-orm";
import { db } from "@/db";
import { memberships, users, conversations, conversationMembers, messages, chatBlocks } from "@/db/schema";
import type { Ctx } from "@/lib/session";

export type Contact = { userId: string; name: string; role: "admin" | "coordinator" | "teacher"; detail: string };

/** Colegas da escola ativa com quem se pode conversar (professores, coordenação e gestão). */
export async function allowedContacts(ctx: Ctx): Promise<Contact[]> {
  const rows = await db.select({ id: users.id, name: users.name, role: memberships.role }).from(memberships).innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.status, "active"), inArray(memberships.role, ["admin", "coordinator", "teacher"])));
  return rows.filter((r) => r.id !== ctx.user.id).map((r) => ({ userId: r.id, name: r.name, role: r.role as Contact["role"], detail: r.role === "teacher" ? "Professor" : r.role === "coordinator" ? "Coordenação" : "Gestão" }));
}

export async function isBlocked(orgId: string, senderId: string, otherIds: string[]) {
  const rows = await db.select().from(chatBlocks).where(eq(chatBlocks.orgId, orgId));
  return { inst: rows.some((b) => b.blockerId === null && b.blockedId === senderId), personal: rows.some((b) => b.blockerId !== null && otherIds.includes(b.blockerId) && b.blockedId === senderId) };
}

/** Mensagens não lidas (de outras pessoas, em conversas de que participa). */
export async function unreadMessages(userId: string): Promise<number> {
  const [r] = await db.select({ n: count() }).from(messages)
    .innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, userId)))
    .where(and(gt(messages.createdAt, conversationMembers.lastReadAt), ne(messages.senderId, userId), isNull(messages.deletedAt), isNull(conversationMembers.leftAt)));
  return Number(r?.n ?? 0);
}

export async function myConversations(userId: string, orgId: string) {
  const rows = await db.select({ c: conversations, muted: conversationMembers.muted }).from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(and(eq(conversationMembers.userId, userId), eq(conversations.orgId, orgId), isNull(conversationMembers.leftAt))).orderBy(sql`${conversations.lastMessageAt} desc`).limit(50);
  const ids = rows.map((r) => r.c.id);
  const members = ids.length ? await db.select({ cid: conversationMembers.conversationId, uid: users.id, name: users.name }).from(conversationMembers).innerJoin(users, eq(users.id, conversationMembers.userId)).where(inArray(conversationMembers.conversationId, ids)) : [];
  const unread = ids.length ? await db.select({ cid: messages.conversationId, n: count() }).from(messages).innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, userId))).where(and(inArray(messages.conversationId, ids), gt(messages.createdAt, conversationMembers.lastReadAt), ne(messages.senderId, userId), isNull(messages.deletedAt))).groupBy(messages.conversationId) : [];
  return rows.map((r) => ({
    ...r.c, muted: r.muted, unread: Number(unread.find((u) => u.cid === r.c.id)?.n ?? 0),
    title: r.c.kind === "direct" ? members.filter((m) => m.cid === r.c.id && m.uid !== userId).map((m) => m.name).join(", ") || "Conversa" : r.c.title ?? "Grupo",
  }));
}
