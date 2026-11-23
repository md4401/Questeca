import Link from "next/link";
import { and, eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { visibleClasses, classStudents } from "@/lib/access";
import { db } from "@/db";
import { documents, classes } from "@/db/schema";
import { Form, Field, SubmitButton } from "@/components/form";
import { createDocumentAction } from "./actions";
import { DOC_KINDS } from "@/lib/docs";
import { rulesFrom } from "@/lib/gradebook";
import { can } from "@/lib/core/permissions";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Documentos da coordenação" };
const STATUS: Record<string, string> = { draft: "Rascunho", in_review: "Em revisão", approved: "Aprovado", returned: "Devolvido" };

export default async function Documentos() {
  const ctx = await requireCtx();
  const cls = await visibleClasses(ctx);
  const reviewer = ctx.org.kind === "school" && can(ctx.org.role, "doc.review");
  const rows = await db.select({ d: documents, cname: classes.name }).from(documents).leftJoin(classes, eq(classes.id, documents.classId)).where(reviewer ? eq(documents.orgId, ctx.org.id) : and(eq(documents.orgId, ctx.org.id), eq(documents.authorId, ctx.user.id))).orderBy(desc(documents.updatedAt));
  const rules = rulesFrom(ctx.org.settings);
  const firstClass = cls[0];
  const studs = firstClass ? await classStudents(firstClass.id) : [];
  return (
    <div className="space-y-6">
      <div><h1>Documentos da coordenação</h1><p className="hint">Informações já registradas viram rascunhos nos formatos da escola. Fatos sem evidência ficam em aberto e a versão final exige revisão.</p></div>
      {reviewer && rows.some((r) => r.d.status === "in_review") && <p className="card-amber">Há documentos aguardando a sua revisão.</p>}
      <section className="card"><h2 className="mb-2 text-lg">Gerar rascunho</h2>
        {cls.length === 0 ? <p className="text-sm">Crie uma turma para gerar documentos.</p> : (
          <Form action={createDocumentAction}>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="field"><label htmlFor="kind">Documento</label><select id="kind" name="kind" className="input" required>{Object.entries(DOC_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div className="field"><label htmlFor="classId">Turma</label><select id="classId" name="classId" className="input" required>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="field"><label htmlFor="period">Período</label><select id="period" name="period" className="input">{rules.periods.map((p) => <option key={p}>{p}</option>)}</select></div>
              <div className="field"><label htmlFor="studentId">Aluno (relatório/devolutiva)</label><select id="studentId" name="studentId" className="input"><option value="">—</option>{studs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><span className="hint">Alunos da primeira turma da lista.</span></div>
            </div>
            <Field label="Prazo (opcional)" name="dueOn" type="date" />
            <SubmitButton>Gerar rascunho</SubmitButton></Form>)}
      </section>
      <section className="card overflow-x-auto"><h2 className="mb-2 text-lg">Documentos</h2>
        {rows.length === 0 ? <p className="text-sm text-ink-soft">Nenhum documento ainda.</p> : <table className="t"><thead><tr><th>Título</th><th>Turma</th><th>Situação</th><th>Prazo</th><th>Atualizado</th></tr></thead><tbody>
          {rows.map(({ d, cname }) => <tr key={d.id}><td><Link href={`/app/documentos/${d.id}`}>{d.title}</Link> <span className="hint">v{d.version}</span></td><td>{cname ?? "—"}</td><td><span className={`badge ${d.status === "approved" ? "" : d.status === "draft" ? "badge-gray" : "badge-amber"}`}>{STATUS[d.status]}</span></td><td>{d.dueOn ? fmtDate(d.dueOn) : "—"}</td><td>{fmtDate(d.updatedAt)}</td></tr>)}</tbody></table>}
      </section>
    </div>
  );
}
