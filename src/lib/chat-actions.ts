"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import { conversations, conversationMembers, messages, messageReactions, taskAttachments, contentReports, chatBlocks, memberships } from "@/db/schema";
import { requireCtx as requireAnyCtx } from "@/lib/session";
import { allowedContacts, isBlocked } from "@/lib/chat";
import { directKey, attachmentProblem, canEdit, REACTIONS } from "@/lib/core/chat";
import { notify, audit } from "@/lib/audit";
import type { FormState } from "@/components/form";

const base = (_role: string) => "/app/chat";
async function memberOf(convId: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(convId)) return null;
  const [m] = await db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, userId), isNull(conversationMembers.leftAt))).limit(1);
  return m ?? null;
}

/** Abre (ou reaproveita) a conversa direta. O destinatário precisa estar entre os contatos permitidos pela política. */
export async function startDirectAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireAnyCtx();
  const to = String(fd.get("to") ?? "");
  const contacts = await allowedContacts(ctx);
  const c = contacts.find((x) => x.userId === to);
  if (!c) return { error: "Você não pode conversar com esta pessoa." };
  const blocked = await isBlocked(ctx.org.id, ctx.user.id, [to]);
  if (blocked.inst || blocked.personal) return { error: "Você não pode enviar mensagens para este contato." };
  const key = directKey(ctx.user.id, to);
  let [conv] = await db.select().from(conversations).where(and(eq(conversations.orgId, ctx.org.id), eq(conversations.directKey, key))).limit(1);
  if (!conv) {
    [conv] = await db.insert(conversations).values({ orgId: ctx.org.id, kind: "direct", directKey: key, createdBy: ctx.user.id }).onConflictDoNothing().returning();
    if (!conv) [conv] = await db.select().from(conversations).where(and(eq(conversations.orgId, ctx.org.id), eq(conversations.directKey, key))).limit(1);
    await db.insert(conversationMembers).values([{ conversationId: conv.id, userId: ctx.user.id }, { conversationId: conv.id, userId: to }]).onConflictDoNothing();
  } else {
    await db.update(conversationMembers).set({ leftAt: null }).where(and(eq(conversationMembers.conversationId, conv.id), eq(conversationMembers.userId, ctx.user.id)));
  }
  redirect(`${base(ctx.org.role)}/${conv.id}`);
}

/** Grupo da equipe (professores/coordenação) com títulos livres. */
export async function createGroupAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireAnyCtx();
  const title = String(fd.get("title") ?? "").trim().slice(0, 100);
  if (title.length < 2) return { error: "Dê um nome ao grupo." };
  const ids = fd.getAll("members").map(String);
  const contacts = await allowedContacts(ctx);
  const members = ids.filter((id) => contacts.some((c) => c.userId === id && (true))); // grupos livres: só equipe
  if (members.length === 0) return { error: "Escolha ao menos um colega da equipe." };
  const [conv] = await db.insert(conversations).values({ orgId: ctx.org.id, kind: "group", title, createdBy: ctx.user.id }).returning();
  await db.insert(conversationMembers).values([ctx.user.id, ...members].map((u) => ({ conversationId: conv.id, userId: u })));
  redirect(`${base(ctx.org.role)}/${conv.id}`);
}

const ROLE_HREF = (_role: string) => "/app/chat";

export async function sendMessageAction(convId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireAnyCtx();
  const mem = await memberOf(convId, ctx.user.id); if (!mem) return { error: "Conversa não encontrada." };
  const [conv] = await db.select().from(conversations).where(and(eq(conversations.id, convId), eq(conversations.orgId, ctx.org.id))).limit(1);
  if (!conv) return { error: "Conversa não encontrada." };
  const body = String(fd.get("body") ?? "").trim();
  const f = fd.get("file"); const hasFile = f instanceof File && f.size > 0;
  if (!body && !hasFile) return { error: "Escreva uma mensagem." };
  if (body.length > 3000) return { error: "A mensagem passa de 3000 caracteres." };
  if (hasFile) { const pr = attachmentProblem(f.type, f.size); if (pr) return { error: pr }; }
  const others = (await db.select({ u: conversationMembers.userId }).from(conversationMembers).where(and(eq(conversationMembers.conversationId, convId), isNull(conversationMembers.leftAt)))).map((r) => r.u).filter((u) => u !== ctx.user.id);
  const bl = await isBlocked(ctx.org.id, ctx.user.id, others);
  if (bl.inst) return { error: "Seu envio de mensagens está bloqueado pela escola." };
  if (conv.kind === "direct" && bl.personal) return { error: "Você não pode enviar mensagens para este contato." };
  const [msg] = await db.insert(messages).values({ conversationId: convId, senderId: ctx.user.id, body: body || "(anexo)", replyToId: String(fd.get("replyTo") ?? "") || null }).returning();
  if (hasFile) await db.insert(taskAttachments).values({ orgId: ctx.org.id, messageId: msg.id, name: f.name.slice(0, 160), type: f.type, data: Buffer.from(await f.arrayBuffer()) });
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, convId));
  await db.update(conversationMembers).set({ lastReadAt: new Date() }).where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, ctx.user.id)));
  const peers = await db.select({ u: conversationMembers.userId, muted: conversationMembers.muted, role: memberships.role }).from(conversationMembers).innerJoin(memberships, and(eq(memberships.userId, conversationMembers.userId), eq(memberships.orgId, ctx.org.id))).where(and(eq(conversationMembers.conversationId, convId), isNull(conversationMembers.leftAt)));
  await Promise.all(peers.filter((p) => p.u !== ctx.user.id && !p.muted).map((p) => notify(p.u, "mensagem", "Nova mensagem", undefined, `${ROLE_HREF(p.role)}/${convId}`, { groupKey: `msg:${convId}` })));
  revalidatePath(`${base(ctx.org.role)}`);
  return { ok: "Enviada." };
}

export async function markReadAction(convId: string) {
  const ctx = await requireAnyCtx();
  if (!(await memberOf(convId, ctx.user.id))) return;
  await db.update(conversationMembers).set({ lastReadAt: new Date() }).where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, ctx.user.id)));
}

export async function editMessageAction(msgId: string, body: string): Promise<FormState> {
  const ctx = await requireAnyCtx();
  const [m] = await db.select().from(messages).where(eq(messages.id, msgId)).limit(1);
  if (!m || m.senderId !== ctx.user.id || m.deletedAt) return { error: "Mensagem não encontrada." };
  if (!(await memberOf(m.conversationId, ctx.user.id))) return { error: "Mensagem não encontrada." };
  if (!canEdit(m.createdAt, new Date())) return { error: "Só é possível editar nos primeiros 15 minutos." };
  const b = body.trim(); if (!b || b.length > 3000) return { error: "Texto inválido." };
  await db.update(messages).set({ body: b, editedAt: new Date() }).where(eq(messages.id, msgId));
  return { ok: "Editada." };
}

export async function deleteMessageAction(msgId: string) {
  const ctx = await requireAnyCtx();
  const [m] = await db.select().from(messages).where(eq(messages.id, msgId)).limit(1);
  if (!m || m.senderId !== ctx.user.id) return;
  await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, msgId));
}

/** Fixar: só a equipe, em conversas de que participa. */
export async function pinMessageAction(msgId: string, pinned: boolean) {
  const ctx = await requireAnyCtx();
  const [m] = await db.select().from(messages).where(eq(messages.id, msgId)).limit(1);
  if (!m || !(await memberOf(m.conversationId, ctx.user.id))) return;
  await db.update(messages).set({ pinned }).where(eq(messages.id, msgId));
}

export async function reactAction(msgId: string, emoji: string) {
  const ctx = await requireAnyCtx();
  if (!(REACTIONS as readonly string[]).includes(emoji)) return;
  const [m] = await db.select().from(messages).where(eq(messages.id, msgId)).limit(1);
  if (!m || !(await memberOf(m.conversationId, ctx.user.id))) return;
  const [ex] = await db.select().from(messageReactions).where(and(eq(messageReactions.messageId, msgId), eq(messageReactions.userId, ctx.user.id), eq(messageReactions.emoji, emoji))).limit(1);
  if (ex) await db.delete(messageReactions).where(and(eq(messageReactions.messageId, msgId), eq(messageReactions.userId, ctx.user.id), eq(messageReactions.emoji, emoji)));
  else await db.insert(messageReactions).values({ messageId: msgId, userId: ctx.user.id, emoji });
}

export async function reportMessageAction(msgId: string) {
  const ctx = await requireAnyCtx();
  const [m] = await db.select().from(messages).where(eq(messages.id, msgId)).limit(1);
  if (!m || !(await memberOf(m.conversationId, ctx.user.id))) return;
  await db.insert(contentReports).values({ orgId: ctx.org.id, targetType: "message", targetId: msgId, reporterId: ctx.user.id }).onConflictDoNothing();
  const coords = await db.select({ u: memberships.userId }).from(memberships).where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.status, "active"), inArray(memberships.role, ["coordinator", "admin"])));
  await Promise.all(coords.map((c) => notify(c.u, "sistema", "Mensagem denunciada", undefined, "/app/moderacao", { groupKey: "rep:msg", priority: "high" })));
  await audit(ctx.user.id, ctx.org.id, "message.reported", msgId);
}

/** Bloqueio pessoal: o outro lado deixa de poder escrever nesta conversa direta. */
export async function blockUserAction(userId: string) {
  const ctx = await requireAnyCtx();
  const [ex] = await db.select().from(chatBlocks).where(and(eq(chatBlocks.orgId, ctx.org.id), eq(chatBlocks.blockerId, ctx.user.id), eq(chatBlocks.blockedId, userId))).limit(1);
  if (!ex) await db.insert(chatBlocks).values({ orgId: ctx.org.id, blockerId: ctx.user.id, blockedId: userId, createdBy: ctx.user.id });
  revalidatePath(base(ctx.org.role));
}

export async function toggleMuteAction(convId: string) {
  const ctx = await requireAnyCtx();
  const m = await memberOf(convId, ctx.user.id); if (!m) return;
  await db.update(conversationMembers).set({ muted: !m.muted }).where(and(eq(conversationMembers.conversationId, convId), eq(conversationMembers.userId, ctx.user.id)));
  revalidatePath(base(ctx.org.role));
}
