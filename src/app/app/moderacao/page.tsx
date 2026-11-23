import { and, eq, inArray, desc, or, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contentReports, messages, users } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { resolveReportAction } from "./actions";
import { fmtDateTime } from "@/lib/format";
import { anyOf } from "@/lib/util";

export const metadata = { title: "Moderação" };

export default async function Moderacao() {
  const ctx = await requireCtx();
  const cls = await visibleClasses(ctx);
  const manager = ctx.org.role === "coordinator" || ctx.org.role === "admin";
  const rows = await db.select().from(contentReports).where(and(eq(contentReports.orgId, ctx.org.id), eq(contentReports.status, "open"), manager ? undefined : or(inArray(contentReports.classId, anyOf(cls.map((c) => c.id))), isNull(contentReports.id)))).orderBy(desc(contentReports.createdAt)).limit(50);
  const visible = manager ? rows : rows.filter((r) => r.classId && cls.some((c) => c.id === r.classId));
  const ms = visible.filter((r) => r.targetType === "message").length ? await db.select({ id: messages.id, body: messages.body, who: users.name }).from(messages).innerJoin(users, eq(users.id, messages.senderId)).where(inArray(messages.id, visible.filter((r) => r.targetType === "message").map((r) => r.targetId))) : [];
  return (
    <div className="max-w-3xl space-y-4">
      <h1>Moderação</h1>
      <p className="hint">Denúncias de mensagens. Remover oculta o conteúdo; a decisão fica registrada.</p>
      {visible.length === 0 ? <p className="card text-ink-soft">Nenhuma denúncia aberta.</p> : visible.map((r) => {
        const c = ms.find((x) => x.id === r.targetId);
        return (
          <section key={r.id} className="card"><p className="text-xs text-ink-soft">Mensagem · denunciado em {fmtDateTime(r.createdAt)}</p>
            <p className="mt-1"><strong>{c?.who ?? "—"}:</strong> {c?.body ?? "(conteúdo indisponível)"}</p>
            <div className="mt-2 flex gap-3"><form action={resolveReportAction.bind(null, r.id, "remove")}><button className="btn btn-sm" type="submit">Remover conteúdo</button></form>{manager && <form action={resolveReportAction.bind(null, r.id, "block")}><button className="btn btn-ghost btn-sm" type="submit">Remover e bloquear autor</button></form>}<form action={resolveReportAction.bind(null, r.id, "dismiss")}><button className="btn btn-ghost btn-sm" type="submit">Dispensar denúncia</button></form></div></section>);
      })}
    </div>
  );
}
