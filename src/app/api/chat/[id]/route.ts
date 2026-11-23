import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { conversationMembers, messages, users, messageReactions, taskAttachments } from "@/db/schema";
import { getCtx } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Últimas mensagens da conversa (atualização por consulta periódica). Só membros; marca como lida. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "nf" }, { status: 404 });
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ error: "auth" }, { status: 401 });
  const [mem] = await db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, ctx.user.id), isNull(conversationMembers.leftAt))).limit(1);
  if (!mem) return NextResponse.json({ error: "nf" }, { status: 404 });
  const rows = (await db.select({ m: messages, name: users.name }).from(messages).innerJoin(users, eq(users.id, messages.senderId)).where(eq(messages.conversationId, id)).orderBy(desc(messages.createdAt)).limit(100)).reverse();
  const ids = rows.map((r) => r.m.id);
  const [reacts, files] = ids.length ? await Promise.all([
    db.select().from(messageReactions).where(inArray(messageReactions.messageId, ids)),
    db.select({ id: taskAttachments.id, name: taskAttachments.name, type: taskAttachments.type, messageId: taskAttachments.messageId }).from(taskAttachments).where(inArray(taskAttachments.messageId, ids)).orderBy(asc(taskAttachments.createdAt)),
  ]) : [[], []];
  await db.update(conversationMembers).set({ lastReadAt: new Date() }).where(and(eq(conversationMembers.conversationId, id), eq(conversationMembers.userId, ctx.user.id)));
  const out = rows.map(({ m, name }) => ({
    id: m.id, mine: m.senderId === ctx.user.id, sender: name, body: m.deletedAt ? "" : m.body, deleted: !!m.deletedAt, pinned: m.pinned, edited: !!m.editedAt, createdAt: m.createdAt.toISOString(), createdMs: m.createdAt.getTime(),
    replyTo: m.replyToId ? (rows.find((r) => r.m.id === m.replyToId)?.m.body ?? null) : null,
    reactions: Object.entries(reacts.filter((r) => r.messageId === m.id).reduce<Record<string, { n: number; mine: boolean }>>((a, r) => { (a[r.emoji] ??= { n: 0, mine: false }).n++; if (r.userId === ctx.user.id) a[r.emoji].mine = true; return a; }, {})).map(([emoji, v]) => ({ emoji, ...v })),
    files: m.deletedAt ? [] : files.filter((f) => f.messageId === m.id).map((f) => ({ id: f.id, name: f.name, type: f.type })),
  }));
  return NextResponse.json({ messages: out, now: Date.now(), staff: ctx.org.role !== "student" && ctx.org.role !== "guardian" }, { headers: { "Cache-Control": "no-store" } });
}
