import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { conversations, conversationMembers, users } from "@/db/schema";
import type { Ctx } from "@/lib/session";
import { ChatView } from "@/components/chat-view";

export async function ChatThread({ ctx, id, base }: { ctx: Ctx; id: string; base: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [conv] = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.orgId, ctx.org.id))).limit(1);
  if (!conv) notFound();
  const members = await db.select({ u: users.id, name: users.name, left: conversationMembers.leftAt }).from(conversationMembers).innerJoin(users, eq(users.id, conversationMembers.userId)).where(and(eq(conversationMembers.conversationId, id), isNull(conversationMembers.leftAt)));
  if (!members.some((m) => m.u === ctx.user.id)) notFound();
  const others = members.filter((m) => m.u !== ctx.user.id);
  const title = conv.kind === "direct" ? others.map((o) => o.name).join(", ") : conv.title ?? "Grupo";
  return (
    <div className="space-y-3">
      <p className="hint"><Link href={base}>Mensagens</Link> › {title}</p>
      <h1 className="text-2xl">{title}</h1>
      {conv.kind !== "direct" && <p className="hint">{members.length} participante(s): {members.map((m) => m.name).join(", ")}</p>}
      <ChatView convId={id} otherUserId={conv.kind === "direct" ? others[0]?.u : undefined} />
    </div>
  );
}
