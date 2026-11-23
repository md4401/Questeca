import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { Ctx } from "@/lib/session";
import { NOTIFY_LABEL, type NotifyCategory } from "@/lib/audit";
import { markNotificationAction, markAllNotificationsAction, saveNotificationPrefsAction } from "@/lib/notification-actions";
import { Form, SubmitButton } from "@/components/form";
import { fmtDateTime } from "@/lib/format";

export async function NotificationCenter({ ctx, base, sp }: { ctx: Ctx; base: string; sp: { cat?: string; nao?: string } }) {
  const cat = sp.cat && sp.cat in NOTIFY_LABEL ? sp.cat : null;
  const conds = [eq(notifications.userId, ctx.user.id)];
  if (cat) conds.push(eq(notifications.category, cat));
  if (sp.nao === "1") conds.push(isNull(notifications.readAt));
  const rows = await db.select().from(notifications).where(and(...conds)).orderBy(desc(notifications.priority), desc(notifications.createdAt)).limit(60);
  const mute = (ctx.user.prefs?.mute ?? []) as string[];
  const q = (o: Record<string, string | undefined>) => { const p = new URLSearchParams(Object.entries({ cat: cat ?? undefined, nao: sp.nao, ...o }).filter(([, v]) => v) as [string, string][]); return `${base}${p.size ? `?${p}` : ""}`; };
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Notificações</h1>
        <form action={markAllNotificationsAction}><button className="btn btn-ghost btn-sm" type="submit">Marcar todas como lidas</button></form>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros">
        <Link className="chip no-underline" aria-current={!cat ? "true" : undefined} href={q({ cat: undefined })}>Todas</Link>
        {(Object.keys(NOTIFY_LABEL) as NotifyCategory[]).map((c) => <Link key={c} className="chip no-underline" aria-current={cat === c ? "true" : undefined} href={q({ cat: c })}>{NOTIFY_LABEL[c]}</Link>)}
        <Link className="chip no-underline" aria-current={sp.nao === "1" ? "true" : undefined} href={q({ nao: sp.nao === "1" ? undefined : "1" })}>Só não lidas</Link>
      </div>
      <section className="card !p-0">
        {rows.length === 0 ? <p className="p-5 text-ink-soft">Nada por aqui.</p> : (
          <ul className="divide-y divide-line">
            {rows.map((n) => (
              <li key={n.id} className={`flex items-start justify-between gap-3 p-4 ${n.readAt ? "" : "bg-brand-tint/50"}`}>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft"><span className="badge">{NOTIFY_LABEL[n.category as NotifyCategory] ?? n.category}</span>{n.priority === "high" && <span className="badge badge-amber">Importante</span>}{fmtDateTime(n.createdAt)}</p>
                  <p className="mt-1 font-semibold">{n.href ? <Link href={n.href}>{n.title}</Link> : n.title}{n.count > 1 && <span className="hint"> · {n.count} avisos</span>}</p>
                  {n.body && <p className="text-sm text-ink-soft">{n.body}</p>}
                </div>
                {!n.readAt && <form action={markNotificationAction.bind(null, n.id)}><button className="link-btn shrink-0" type="submit" aria-label={`Marcar como lida: ${n.title}`}>Lida</button></form>}
              </li>))}
          </ul>)}
      </section>
      <section className="card">
        <h2 className="mb-1 text-lg">Quais avisos você quer receber</h2>
        <p className="hint mb-3">Segurança e pagamento sempre chegam. Avisos importantes também passam por categorias silenciadas.</p>
        <Form action={saveNotificationPrefsAction}>
          <div className="grid gap-2 sm:grid-cols-2">{(Object.keys(NOTIFY_LABEL) as NotifyCategory[]).map((c) => {
            const fixed = c === "seguranca" || c === "pagamento";
            return <label key={c} className="flex items-center gap-2 font-normal"><input type="checkbox" name={`c_${c}`} defaultChecked={fixed || !mute.includes(c)} disabled={fixed} />{NOTIFY_LABEL[c]}</label>;
          })}</div>
          <div className="mt-3"><SubmitButton>Salvar preferências</SubmitButton></div>
        </Form>
      </section>
    </div>
  );
}
