import Link from "next/link";
import { eq, desc, and, count } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { db } from "@/db";
import { applications, assessments, observations, lessonLogs, gradeItems, grades, answerSheets } from "@/db/schema";
import { fmtDate } from "@/lib/format";
import { Form, SubmitButton } from "@/components/form";
import { addLessonLogAction, archiveClassAction } from "../actions";
import { TOPICS, topicName } from "@/lib/taxonomy";

export default async function VisaoGeral({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, id);
  const [studs, apps, drafts, obs, logs, pendingCells, pendingSheets] = await Promise.all([
    classStudents(id),
    db.select().from(applications).where(eq(applications.classId, id)).orderBy(desc(applications.appliedOn)).limit(5),
    db.select().from(assessments).where(and(eq(assessments.classId, id), eq(assessments.status, "draft"))).orderBy(desc(assessments.updatedAt)).limit(3),
    db.select().from(observations).where(eq(observations.classId, id)).orderBy(desc(observations.createdAt)).limit(3),
    db.select().from(lessonLogs).where(eq(lessonLogs.classId, id)).orderBy(desc(lessonLogs.taughtOn)).limit(5),
    db.select({ n: count() }).from(grades).innerJoin(gradeItems, eq(gradeItems.id, grades.gradeItemId)).where(and(eq(gradeItems.classId, id), eq(grades.state, "pending"))),
    db.select({ n: count() }).from(answerSheets).innerJoin(applications, eq(applications.id, answerSheets.applicationId)).where(and(eq(applications.classId, id), eq(answerSheets.status, "pending_review"))),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        <section className="card">
          <h2 className="mb-2">Resumo</h2>
          <p>{studs.length} aluno(s) · {apps.length ? `${apps.length} avaliação(ões) recente(s)` : "nenhuma avaliação aplicada ainda"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="btn btn-sm" href={`/app/provas/nova?turma=${id}`}>Nova prova para esta turma</Link>
            <Link className="btn btn-ghost btn-sm" href={`/app/turmas/${id}/notas`}>Lançar notas</Link>
          </div>
        </section>
        <section className="card">
          <h2 className="mb-2">Pendências</h2>
          <ul className="space-y-1 text-sm">
            {Number(pendingCells[0].n) > 0 && <li>• {Number(pendingCells[0].n)} nota(s) pendente(s) — <Link href={`/app/turmas/${id}/notas`}>abrir notas</Link></li>}
            {Number(pendingSheets[0].n) > 0 && <li>• {Number(pendingSheets[0].n)} cartão(ões) aguardando conferência</li>}
            {drafts.map((d) => <li key={d.id}>• Rascunho: <Link href={`/app/provas/${d.id}`}>{d.title}</Link></li>)}
            {!Number(pendingCells[0].n) && !Number(pendingSheets[0].n) && !drafts.length && <li className="text-ink-soft">Nada pendente.</li>}
          </ul>
        </section>
        <section className="card">
          <h2 className="mb-2">Avaliações recentes</h2>
          {apps.length ? <table className="t"><thead><tr><th>Avaliação</th><th>Data</th><th>Tipo</th></tr></thead><tbody>
            {apps.map((a) => <tr key={a.id}><td><Link href={`/app/turmas/${id}/avaliacoes`}>{a.title}</Link></td><td>{fmtDate(a.appliedOn)}</td><td>{a.kind === "regular" ? "Regular" : a.kind === "second" ? "Segunda chamada" : "Externa"}</td></tr>)}
          </tbody></table> : <p className="text-sm text-ink-soft">Nenhuma aplicação registrada.</p>}
        </section>
      </div>
      <div className="space-y-6">
        <section className="card" aria-labelledby="diario">
          <h2 id="diario" className="mb-2 text-lg">Registrar aula</h2>
          <Form action={addLessonLogAction.bind(null, id)} resetOnOk>
            <div className="field"><label htmlFor="content">O que aconteceu na aula?</label><textarea id="content" name="content" className="input" required /></div>
            <fieldset className="field"><legend className="label">Conteúdos ensinados</legend>
              <div className="max-h-40 overflow-auto rounded border border-line p-2 text-sm">
                {TOPICS.map((t) => <label key={t.slug} className="flex gap-2 py-0.5 font-normal"><input type="checkbox" name="topics" value={t.slug} />{t.name}</label>)}
              </div>
              <span className="hint">Os confirmados aqui passam a sugerir o escopo da próxima prova.</span></fieldset>
            <label className="mb-3 flex gap-2 font-normal"><input type="checkbox" name="planned" defaultChecked />Estava no planejamento</label>
            <SubmitButton>Salvar registro</SubmitButton>
          </Form>
          {logs.length > 0 && <ul className="mt-4 space-y-2 border-t border-line pt-3 text-sm">{logs.map((l) => <li key={l.id}><strong>{fmtDate(l.taughtOn)}</strong> — {l.content}{l.topics.length > 0 && <span className="hint"> ({l.topics.map(topicName).join(", ")})</span>}</li>)}</ul>}
        </section>
        {obs.length > 0 && <section className="card"><h2 className="mb-2 text-lg">Últimas observações</h2><ul className="space-y-2 text-sm">{obs.map((o) => <li key={o.id}>{fmtDate(o.observedOn)} — {o.text}</li>)}</ul></section>}
        <form action={archiveClassAction.bind(null, id)}><button className="link-btn text-danger" type="submit">Arquivar turma</button></form>
        {cls.isDemo && <p className="hint">Turma de exemplo: dados fictícios identificados.</p>}
      </div>
    </div>
  );
}
