import Link from "next/link";
import { and, eq, isNull, ilike, desc } from "drizzle-orm";
import { db } from "@/db";
import { messages, conversationMembers, conversations, users } from "@/db/schema";
import type { Ctx } from "@/lib/session";
import { allowedContacts, myConversations, policyOf } from "@/lib/chat";
import { startDirectAction, createGroupAction, toggleMuteAction } from "@/lib/chat-actions";
import { Form, SubmitButton } from "@/components/form";
import { isStaff, type ChatRole } from "@/lib/core/chat";
import { fmtDateTime } from "@/lib/format";

/** Lista de conversas, busca nas minhas mensagens e início de conversa (só entre contatos permitidos). */
export async function ChatHome({ ctx, base, q }: { ctx: Ctx; base: string; q?: string }) {
  const [convs, contacts] = await Promise.all([myConversations(ctx.user.id, ctx.org.id), allowedContacts(ctx)]);
  const policy = policyOf(ctx);
  const term = (q ?? "").trim().slice(0, 80);
  const found = term.length >= 2 ? await db.select({ id: messages.id, convId: messages.conversationId, body: messages.body, at: messages.createdAt, who: users.name }).from(messages)
    .innerJoin(conversationMembers, and(eq(conversationMembers.conversationId, messages.conversationId), eq(conversationMembers.userId, ctx.user.id)))
    .innerJoin(conversations, and(eq(conversations.id, messages.conversationId), eq(conversations.orgId, ctx.org.id)))
    .innerJoin(users, eq(users.id, messages.senderId)).where(and(ilike(messages.body, `%${term.replace(/[%_\\]/g, "\\$&")}%`), isNull(messages.deletedAt), isNull(conversationMembers.leftAt))).orderBy(desc(messages.createdAt)).limit(20) : [];
  const staff = isStaff(ctx.org.role as ChatRole);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <h1>Mensagens</h1>
        <form className="flex gap-2" role="search"><label className="sr-only" htmlFor="q">Buscar nas minhas mensagens</label><input id="q" name="q" defaultValue={term} className="input flex-1" placeholder="Buscar nas minhas mensagens" /><button className="btn btn-ghost" type="submit">Buscar</button></form>
        {term.length >= 2 && (
          <section className="card"><h2 className="mb-2 text-lg">Resultados para “{term}”</h2>
            {found.length === 0 ? <p className="text-sm text-ink-soft">Nada encontrado.</p> : <ul className="space-y-2 text-sm">{found.map((f) => <li key={f.id}><Link href={`${base}/${f.convId}`}>{f.who}: {f.body.slice(0, 100)}</Link> <span className="hint">· {fmtDateTime(f.at)}</span></li>)}</ul>}</section>)}
        <section className="card !p-0">
          {convs.length === 0 ? <p className="p-5 text-ink-soft">Nenhuma conversa ainda.</p> : (
            <ul className="divide-y divide-line">{convs.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 p-4">
                <Link href={`${base}/${c.id}`} className="min-w-0 flex-1 no-underline"><p className="truncate font-semibold text-ink">{c.title}{c.kind !== "direct" && <span className="badge ml-2">{c.kind === "class" ? "Turma" : "Grupo"}</span>}</p><p className="hint">{fmtDateTime(c.lastMessageAt)}</p></Link>
                {c.unread > 0 && <span className="badge" aria-label={`${c.unread} não lidas`}>{c.unread}</span>}
                <form action={toggleMuteAction.bind(null, c.id)}><button className="link-btn" type="submit">{c.muted ? "Reativar avisos" : "Silenciar"}</button></form>
              </li>))}</ul>)}
        </section>
      </div>
      <div className="space-y-4">
        <section className="card"><h2 className="mb-2 text-lg">Nova conversa</h2>
          {contacts.length === 0 ? <p className="text-sm text-ink-soft">{staff ? "Ninguém disponível ainda. Convide alunos e responsáveis pela turma." : "A escola ainda não habilitou mensagens para você, ou não há professores vinculados."}</p> : (
            <Form action={startDirectAction}>
              <div className="field"><label htmlFor="to">Conversar com</label><select id="to" name="to" className="input" defaultValue="">{<option value="" disabled>Escolha…</option>}{contacts.map((c) => <option key={c.userId} value={c.userId}>{c.name} — {c.detail}</option>)}</select></div>
              <SubmitButton>Abrir conversa</SubmitButton></Form>)}
          {!staff && policy.hoursFrom && <p className="hint mt-2">Mensagens são respondidas entre {policy.hoursFrom} e {policy.hoursTo}.</p>}
        </section>
        {staff && (
          <section className="card"><h2 className="mb-2 text-lg">Grupo da equipe</h2>
            <Form action={createGroupAction}>
              <div className="field"><label htmlFor="title">Nome do grupo</label><input id="title" name="title" className="input" /></div>
              <fieldset className="field"><legend className="mb-1 text-sm font-semibold">Participantes</legend>{contacts.filter((c) => isStaff(c.role)).map((c) => <label key={c.userId} className="flex items-center gap-2 py-1 font-normal"><input type="checkbox" name="members" value={c.userId} />{c.name} <span className="hint">· {c.detail}</span></label>)}</fieldset>
              <SubmitButton>Criar grupo</SubmitButton></Form></section>)}
      </div>
    </div>
  );
}
