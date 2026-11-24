import { sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import type { Ctx } from "@/lib/session";
import { allowedContacts, myConversations } from "@/lib/chat";
import { ChatList } from "@/components/chat-list";

/** Estrutura em duas colunas (estilo WhatsApp/Slack): conversas à esquerda, conversa aberta (ou aviso) à direita. No celular mostra só uma por vez. */
export async function ChatHome({ ctx, base, activeId, children }: { ctx: Ctx; base: string; activeId?: string; children?: React.ReactNode }) {
  const [convs, contacts] = await Promise.all([myConversations(ctx.user.id, ctx.org.id), allowedContacts(ctx)]);
  const ids = convs.map((c) => c.id);
  const ult = ids.length ? await db.selectDistinctOn([messages.conversationId], { cid: messages.conversationId, body: messages.body, del: messages.deletedAt }).from(messages).where(inArray(messages.conversationId, ids)).orderBy(messages.conversationId, sql`${messages.createdAt} desc`) : [];
  const itens = convs.map((c) => { const m = ult.find((u) => u.cid === c.id); return { id: c.id, title: c.title, kind: c.kind, unread: c.unread, muted: c.muted, at: c.lastMessageAt.toISOString(), preview: m ? (m.del ? "Mensagem apagada" : m.body.slice(0, 80)) : "" }; });
  return (
    <div className={`chat-shell ${activeId ? "has-active" : ""}`}>
      <ChatList convs={itens} contacts={contacts.map((c) => ({ userId: c.userId, name: c.name, detail: c.detail }))} base={base} activeId={activeId} />
      <section className="chat-pane">
        {children ?? <div className="chat-empty"><p>Escolha uma conversa para começar.</p></div>}
      </section>
    </div>
  );
}
