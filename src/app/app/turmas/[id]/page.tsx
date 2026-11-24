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
import { classAnalytics } from "@/lib/analytics";
import { rulesFrom } from "@/lib/gradebook";

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
  const an = studs.length ? await classAnalytics(id, ctx.org.settings, rulesFrom(ctx.org.settings).periods[0]) : null;
  const level = (r: { level: string }) => (r.level === "alerta" ? "risco" : r.level === "atencao" ? "atencao" : "regular");
  const levelLabel = { risco: "Risco", atencao: "Atenção", regular: "Regular" } as const;
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {an && an.rows.length > 0 && (
          <section className="card" aria-label="Alunos da turma"><div className="section-title"><h2>Alunos ({an.rows.length})</h2><Link href={`/app/turmas/${id}/alunos`}>Gerenciar</Link></div>
            <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{an.rows.map((r) => { const lv = level(r.risk) as keyof typeof levelLabel; const avg = r.average; return (
              <li key={r.student.id} className="rounded-xl border border-line p-3">
                <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2.5"><span className="avatar" aria-hidden>{r.student.name.trim().slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate font-semibold">{r.student.name}</p><p className="hint">{r.student.registration ?? "sem matrícula"}</p></div></div><span className="chip-status" data-s={lv}>{levelLabel[lv]}</span></div>
                <div className="mt-2.5 flex items-center justify-between text-sm"><span className="hint">Média</span><strong>{avg == null ? "—" : String(Math.round(avg * 10) / 10).replace(".", ",")}</strong></div>
                <div className="pbar mt-1" data-tone={lv === "risco" ? "danger" : lv === "atencao" ? "amber" : undefined} role="img" aria-label={`Média de ${r.student.name}: ${avg == null ? "sem notas" : Math.round(avg * 10) / 10}`}><i style={{ width: `${avg == null ? 0 : Math.min(100, (avg / an.rules.scaleMax) * 100)}%` }} /></div>
              </li>); })}</ul></section>)}
        {(Number(pendingCells[0].n) > 0 || Number(pendingSheets[0].n) > 0 || drafts.length > 0) && (
          <section className="card" aria-label="Pendências">
            <h2 className="mb-2">Pendências</h2>
            <ul className="space-y-1 text-sm">
              {Number(pendingCells[0].n) > 0 && <li>• {Number(pendingCells[0].n)} nota(s) pendente(s) — <Link href={`/app/turmas/${id}/notas`}>abrir notas</Link></li>}
              {Number(pendingSheets[0].n) > 0 && <li>• {Number(pendingSheets[0].n)} cartão(ões) aguardando conferência</li>}
              {drafts.map((d) => <li key={d.id}>• Rascunho: <Link href={`/app/provas/${d.id}`}>{d.title}</Link></li>)}
            </ul>
          </section>)}
        {apps.length > 0 && (
          <section className="card" aria-label="Avaliações recentes">
            <div className="section-title"><h2>Avaliações recentes</h2><Link href={`/app/turmas/${id}/avaliacoes`}>Ver todas</Link></div>
            <ul className="list-rows text-sm">{apps.slice(0, 3).map((a) => <li key={a.id}><Link href={`/app/turmas/${id}/avaliacoes`}>{a.title}</Link> <span className="hint">· {fmtDate(a.appliedOn)}</span></li>)}</ul>
          </section>)}
      </div>
      <div className="space-y-6">
        <details className="card fold" aria-labelledby="diario">
          <summary id="diario">Registrar aula</summary>
          <div className="mt-3">
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
        </div></details>
        <form action={archiveClassAction.bind(null, id)}><button className="link-btn text-danger" type="submit">Arquivar turma</button></form>
        {cls.isDemo && <p className="hint">Turma de exemplo: dados fictícios identificados.</p>}
      </div>
    </div>
  );
}
