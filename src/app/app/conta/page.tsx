import { eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { sessions, notifications } from "@/db/schema";
import { Form, Field, SubmitButton } from "@/components/form";
import { updateProfileAction, changePasswordAction, revokeSessionAction, markReadAction, requestDeletionAction } from "./actions";
import { changeEmailVerificationAction, logoutAllAction, resendVerificationAction } from "@/lib/auth-actions";
import { fmtDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/core/permissions";
import Link from "next/link";
import { userAvatars } from "@/db/schema";
import { AvatarForm } from "@/components/avatar-form";
import { ThemePicker, ThemeSync } from "@/components/theme";

export const metadata = { title: "Minha conta" };

export default async function Conta({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const ss = await db.select().from(sessions).where(eq(sessions.userId, ctx.user.id)).orderBy(desc(sessions.createdAt));
  const notes = await db.select().from(notifications).where(eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(15);
  const p = ctx.user.prefs ?? {};
  const [av] = await db.select({ at: userAvatars.updatedAt }).from(userAvatars).where(eq(userAvatars.userId, ctx.user.id)).limit(1);
  return (
    <div className="max-w-3xl space-y-6">
      <h1>Minha conta</h1>
      {sp.ok && <p className="card-tint" role="status">{sp.ok}</p>}
      <section className="card"><h2 className="mb-1 text-lg">Colégio, disciplinas e turmas</h2>
        <p className="hint mb-3">{ctx.org.name}{ctx.org.city ? ` · ${ctx.org.city}/${ctx.org.uf}` : ""}</p>
        <Link className="btn btn-ghost" href="/cadastro?editar=1">Editar esses dados</Link></section>
      <ThemeSync theme={p.theme} />
      <AvatarForm userId={ctx.user.id} name={ctx.user.name} has={!!av} v={av?.at.getTime()} />
      <section className="card"><ThemePicker initial={p.theme ?? "light"} /><p className="hint mt-2">Notificações por categoria: <Link href="/app/notificacoes">Central de notificações</Link>.</p></section>
      <section className="card"><h2 className="mb-2 text-lg">Perfil e preferências</h2>
        <Form action={updateProfileAction}>
          <Field label="Nome" name="name" defaultValue={ctx.user.name} required />
          <label className="mb-2 flex gap-2 font-normal"><input type="checkbox" name="largeFont" defaultChecked={!!p.largeFont} />Fonte maior na interface</label>
          <label className="mb-2 flex gap-2 font-normal"><input type="checkbox" name="notifyCommunity" defaultChecked={p.notifyCommunity !== false} />Avisos de atividade da comunidade</label>
          <label className="mb-3 flex gap-2 font-normal"><input type="checkbox" name="notifyMarketing" defaultChecked={!!p.notifyMarketing} />Novidades e dicas do produto (opcional)</label>
          <SubmitButton>Salvar</SubmitButton></Form></section>
      <section className="card"><h2 className="mb-2 text-lg">E-mail</h2>
        <p className="mb-2 text-sm">{ctx.user.email} {ctx.user.emailVerifiedAt ? <span className="badge">confirmado</span> : <span className="badge badge-amber">não confirmado</span>}</p>
        {!ctx.user.emailVerifiedAt && <form action={resendVerificationAction} className="mb-3"><button className="link-btn" type="submit">Reenviar link de confirmação</button></form>}
        <Form action={changeEmailVerificationAction}><Field label="Novo e-mail" name="email" type="email" hint="A troca vale depois de confirmar o novo endereço." /><SubmitButton className="btn btn-ghost">Enviar confirmação</SubmitButton></Form></section>
      <section className="card"><h2 className="mb-2 text-lg">Senha</h2>
        <Form action={changePasswordAction}><Field label="Senha atual" name="current" type="password" required autoComplete="current-password" /><Field label="Nova senha" name="next" type="password" required autoComplete="new-password" /><SubmitButton>Alterar senha</SubmitButton></Form></section>
      <section className="card"><h2 className="mb-2 text-lg">Sessões abertas</h2>
        <ul className="space-y-2 text-sm">{ss.map((s) => <li key={s.id} className="flex items-center justify-between gap-2"><span>{s.userAgent?.slice(0, 60) || "Dispositivo"} · {fmtDateTime(s.createdAt)}{s.id === ctx.sessionId && <span className="badge ml-2">esta sessão</span>}</span>{s.id !== ctx.sessionId && <form action={revokeSessionAction.bind(null, s.id)}><button className="link-btn" type="submit">Encerrar</button></form>}</li>)}</ul>
        <form action={logoutAllAction} className="mt-3"><button className="btn btn-ghost btn-sm" type="submit">Sair de todos os dispositivos</button></form></section>
      <section className="card"><h2 className="mb-2 text-lg">Escolas e papéis</h2><ul className="text-sm">{ctx.orgs.map((o) => <li key={o.id}>{o.name} — {ROLE_LABEL[o.role]}{o.kind === "personal" ? " (pessoal)" : ""}</li>)}</ul></section>
      <section className="card"><div className="flex items-center justify-between"><h2 className="text-lg">Notificações</h2><form action={markReadAction}><button className="link-btn" type="submit">Marcar todas como lidas</button></form></div>
        {notes.length === 0 ? <p className="text-sm text-ink-soft">Sem notificações.</p> : <ul className="mt-2 space-y-2 text-sm">{notes.map((n) => <li key={n.id} className={n.readAt ? "text-ink-soft" : "font-medium"}><span className="badge badge-gray mr-2">{n.category}</span>{n.href ? <Link href={n.href}>{n.title}</Link> : n.title}{n.body && <span className="hint"> — {n.body}</span>}</li>)}</ul>}</section>
      <section className="card"><h2 className="mb-2 text-lg">Privacidade</h2><p className="text-sm text-ink-soft">Você pode solicitar a exportação ou a exclusão dos seus dados. Dados institucionais seguem o contrato da escola.</p>
        <form action={requestDeletionAction} className="mt-2"><button className="btn btn-ghost btn-sm" type="submit">Solicitar exportação/exclusão dos meus dados</button></form></section>
    </div>
  );
}
