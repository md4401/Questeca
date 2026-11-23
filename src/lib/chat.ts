import "server-only";
import { and, eq, inArray, isNull, gt, ne, sql, count } from "drizzle-orm";
import { db } from "@/db";
import { memberships, users, classTeachers, enrollments, classes, studentAccounts, guardianLinks, students, conversations, conversationMembers, messages, chatBlocks } from "@/db/schema";
import type { Ctx } from "@/lib/session";
import { visibleStudents, anyOf } from "@/lib/portal";
import { visibleClasses } from "@/lib/access";
import { canStart, policyFrom, isStaff, type ChatRole, type Policy } from "@/lib/core/chat";

export type Contact = { userId: string; name: string; role: ChatRole; detail: string };
export const policyOf = (ctx: Ctx): Policy => policyFrom(ctx.org.settings.chat);

/** Quem este usuário pode procurar para conversar. Já aplica a política da escola; o envio revalida. */
export async function allowedContacts(ctx: Ctx): Promise<Contact[]> {
  const policy = policyOf(ctx);
  const role = ctx.org.role as ChatRole;
  const out = new Map<string, Contact>();
  const add = (c: Contact) => { if (c.userId !== ctx.user.id && !out.has(c.userId)) out.set(c.userId, c); };
  const staffRows = await db.select({ id: users.id, name: users.name, role: memberships.role }).from(memberships).innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.status, "active"), inArray(memberships.role, ["admin", "coordinator", "teacher"])));
  if (isStaff(role)) {
    for (const r of staffRows) add({ userId: r.id, name: r.name, role: r.role as ChatRole, detail: r.role === "teacher" ? "Professor" : r.role === "coordinator" ? "Coordenação" : "Gestão" });
    const cls = role === "admin" ? [] : await visibleClasses(ctx);
    const classIds = cls.map((c) => c.id);
    if (classIds.length) {
      const enr = await db.select({ studentId: enrollments.studentId, classId: enrollments.classId }).from(enrollments).where(and(inArray(enrollments.classId, classIds), eq(enrollments.status, "active")));
      const sids = [...new Set(enr.map((e) => e.studentId))];
      if (sids.length) {
        const [acc, gl, st] = await Promise.all([
          db.select({ u: studentAccounts.userId, s: studentAccounts.studentId, n: users.name }).from(studentAccounts).innerJoin(users, eq(users.id, studentAccounts.userId)).where(inArray(studentAccounts.studentId, sids)),
          db.select({ u: guardianLinks.userId, s: guardianLinks.studentId, n: users.name }).from(guardianLinks).innerJoin(users, eq(users.id, guardianLinks.userId)).where(inArray(guardianLinks.studentId, sids)),
          db.select({ id: students.id, name: students.name }).from(students).where(inArray(students.id, sids)),
        ]);
        const sname = (id: string) => st.find((x) => x.id === id)?.name ?? "";
        for (const a of acc) add({ userId: a.u, name: a.n, role: "student", detail: `Aluno(a) · ${sname(a.s)}` });
        for (const g of gl) add({ userId: g.u, name: g.n, role: "guardian", detail: `Responsável de ${sname(g.s)}` });
      }
    }
    return [...out.values()];
  }
  // aluno/responsável: equipe das turmas do estudante (+ coordenação), conforme a política
  const mine = await visibleStudents(ctx);
  const sids = mine.map((m) => m.id);
  const cls = sids.length ? await db.select({ classId: enrollments.classId }).from(enrollments).where(and(inArray(enrollments.studentId, anyOf(sids)), eq(enrollments.status, "active"))) : [];
  const classIds = [...new Set(cls.map((c) => c.classId))];
  const teachers = classIds.length ? await db.select({ u: classTeachers.userId, c: classes.name }).from(classTeachers).innerJoin(classes, eq(classes.id, classTeachers.classId)).where(inArray(classTeachers.classId, classIds)) : [];
  for (const t of teachers) {
    const r = staffRows.find((s) => s.id === t.u); if (!r) continue;
    if (canStart(role, r.role as ChatRole, true, policy).ok) add({ userId: r.id, name: r.name, role: r.role as ChatRole, detail: `Professor · ${t.c}` });
  }
  for (const r of staffRows) if (r.role === "coordinator" && canStart(role, "coordinator", true, policy).ok) add({ userId: r.id, name: r.name, role: "coordinator", detail: "Coordenação" });
  return [...out.values()];
}

export async function isBlocked(orgId: string, senderId: string, otherIds: string[]) {
  const rows = await db.select().from(chatBlocks).where(and(eq(chatBlocks.orgId, orgId)));
  const inst = rows.some((b) => b.blockerId === null && b.blockedId === senderId);
  const personal = rows.some((b) => b.blockerId !== null && otherIds.includes(b.blockerId) && b.blockedId === senderId);
  return { inst, personal };
}

/** Mensagens não lidas do usuário (de outras pessoas, em conversas que ele integra e não silenciou). */
export async function unreadMessages(userId: string): Promise<number> {
  const [r] = await db.select({ n: count() }).from(messages)
    .innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, userId)))
    .where(and(gt(messages.createdAt, conversationMembers.lastReadAt), ne(messages.senderId, userId), isNull(messages.deletedAt), isNull(conversationMembers.leftAt)));
  return Number(r?.n ?? 0);
}

export async function myConversations(userId: string, orgId: string) {
  const rows = await db.select({ c: conversations, lastReadAt: conversationMembers.lastReadAt, muted: conversationMembers.muted }).from(conversationMembers)
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
