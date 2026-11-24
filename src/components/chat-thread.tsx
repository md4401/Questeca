import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { conversations, conversationMembers, users } from "@/db/schema";
import type { Ctx } from "@/lib/session";
import { toggleMuteAction } from "@/lib/chat-actions";
import { ChatView } from "@/components/chat-view";

/** Painel direito: cabeçalho da conversa + mensagens. */
export async function ChatThread({ ctx, id, base }: { ctx: Ctx; id: string; base: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [conv] = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.orgId, ctx.org.id))).limit(1);
  if (!conv) notFound();
  const members = await db.select({ u: users.id, name: users.name, muted: conversationMembers.muted }).from(conversationMembers).innerJoin(users, eq(users.id, conversationMembers.userId)).where(and(eq(conversationMembers.conversationId, id), isNull(conversationMembers.leftAt)));
  const me = members.find((m) => m.u === ctx.user.id);
  if (!me) notFound();
  const others = members.filter((m) => m.u !== ctx.user.id);
  const title = conv.kind === "direct" ? others.map((o) => o.name).join(", ") : conv.title ?? "Grupo";
  const ini = title.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  return (
    <div className="chat-thread">
      <header className="chat-head">
        <Link href={base} className="chat-back" aria-label="Voltar às conversas">‹</Link>
        <span className="chat-av" aria-hidden>{conv.kind === "direct" ? ini : "👥"}</span>
        <div className="min-w-0 flex-1"><h2 className="truncate">{title}</h2><p className="hint truncate">{conv.kind === "direct" ? "Conversa direta" : `${members.length} participantes`}{conv.kind !== "direct" ? ` · ${members.map((m) => m.name).join(", ")}` : ""}</p></div>
        <form action={toggleMuteAction.bind(null, id)}><button className="chat-info" type="submit" title={me.muted ? "Reativar avisos" : "Silenciar avisos"} aria-label={me.muted ? "Reativar avisos" : "Silenciar avisos"}>{me.muted ? "🔕" : "🔔"}</button></form>
      </header>
      <ChatView convId={id} otherUserId={conv.kind === "direct" ? others[0]?.u : undefined} />
    </div>
  );
}
