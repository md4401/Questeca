import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { Form, SubmitButton } from "@/components/form";
import { saveDocumentAction, submitDocumentAction, reviewDocumentAction, newVersionAction } from "../actions";
import { can } from "@/lib/core/permissions";

export const metadata = { title: "Documento" };
const STATUS: Record<string, string> = { draft: "Rascunho", in_review: "Em revisão institucional", approved: "Versão final aprovada", returned: "Devolvido com observações" };

export default async function Documento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/app/documentos");
  const [d] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id))).limit(1);
  if (!d) redirect("/app/documentos");
  const reviewer = ctx.org.kind === "school" && can(ctx.org.role, "doc.review");
  if (d.authorId !== ctx.user.id && !reviewer) redirect("/app/documentos");
  const mine = d.authorId === ctx.user.id;
  const editable = mine && d.status !== "approved" && d.status !== "in_review";
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <p className="hint"><Link href="/app/documentos">Documentos</Link> › {d.title}</p>
        <h1 className="mb-1">{d.title}</h1>
        <p className="mb-4"><span className={`badge ${d.status === "approved" ? "" : "badge-amber"}`}>{STATUS[d.status]}</span> <span className="hint">versão {d.version}</span></p>
        {d.reviewNote && <p className="card-amber mb-4"><strong>Observações da revisão:</strong> {d.reviewNote}</p>}
        <Form action={saveDocumentAction.bind(null, id)}>
          <div className="field"><label htmlFor="title">Título</label><input id="title" name="title" defaultValue={d.title} className="input" readOnly={!editable} /></div>
          <div className="field"><label htmlFor="body">Conteúdo</label><textarea id="body" name="body" defaultValue={d.body} className="input" style={{ minHeight: 420, fontFamily: "var(--font-serif)" }} readOnly={!editable} /></div>
          {d.openGaps.length > 0 && editable && <fieldset className="card-amber mb-3"><legend className="label px-1">Pontos em aberto — marque quando resolvidos</legend>{d.openGaps.map((g) => <label key={g} className="flex gap-2 font-normal text-sm"><input type="checkbox" name="resolved" value={g} />{g}</label>)}</fieldset>}
          {editable && <SubmitButton>Salvar rascunho</SubmitButton>}
        </Form>
        <div className="mt-4 flex flex-wrap gap-3">
          {editable && <form action={submitDocumentAction.bind(null, id)}><button className="btn" type="submit" disabled={d.openGaps.length > 0} title={d.openGaps.length ? "Resolva os pontos em aberto" : ""}>{ctx.org.kind === "school" ? "Enviar para revisão" : "Confirmar versão final"}</button></form>}
          {d.status === "approved" && <a className="btn" href={`/api/export/documento?id=${id}`}>Baixar PDF</a>}
          {d.status === "approved" && mine && <form action={newVersionAction.bind(null, id)}><button className="btn btn-ghost" type="submit">Nova versão</button></form>}
        </div>
        {editable && d.openGaps.length > 0 && <p className="hint mt-2">A versão final só é liberada quando os pontos em aberto forem resolvidos (fatos não registrados ficam em aberto).</p>}
      </div>
      <aside className="space-y-4">
        <section className="card"><h2 className="mb-2 text-lg">Evidências usadas</h2>{d.evidence.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{d.evidence.slice(0, 20).map((e, i) => <li key={i}>{e.label} <span className="hint">({e.source})</span></li>)}</ul> : <p className="text-sm text-ink-soft">Nenhuma evidência encontrada.</p>}</section>
        {reviewer && d.status === "in_review" && (
          <section className="card"><h2 className="mb-2 text-lg">Revisão institucional</h2>
            <Form action={reviewDocumentAction.bind(null, id, false)}><div className="field"><label htmlFor="note">Observações</label><textarea id="note" name="note" className="input" /></div><div className="flex gap-2"><SubmitButton className="btn btn-ghost">Devolver</SubmitButton></div></Form>
            <Form action={reviewDocumentAction.bind(null, id, true)} className="mt-3"><SubmitButton>Aprovar versão final</SubmitButton></Form></section>)}
      </aside>
    </div>
  );
}
