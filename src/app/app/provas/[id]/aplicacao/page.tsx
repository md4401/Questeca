import Link from "next/link";
import { eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { loadAssessment, visibleClasses } from "@/lib/access";
import { db } from "@/db";
import { applications, assessmentVersions, classes } from "@/db/schema";
import { Form, Field, SubmitButton } from "@/components/form";
import { createApplicationAction, createSecondCallAction } from "../../actions";
import { conflictsFor, getItems } from "@/lib/assessments";
import { fmtDate, todayISO } from "@/lib/format";
import { planInfo } from "@/lib/billing";

export const metadata = { title: "Aplicação" };

export default async function Aplicacao({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const items = await getItems(id);
  const conflicts = await conflictsFor(id, a.scope);
  const apps = await db.select({ app: applications, v: assessmentVersions.number, cname: classes.name }).from(applications).leftJoin(assessmentVersions, eq(assessmentVersions.id, applications.versionId)).innerJoin(classes, eq(classes.id, applications.classId)).where(eq(applications.assessmentId, id)).orderBy(desc(applications.createdAt));
  const cls = await visibleClasses(ctx);
  const info = await planInfo(ctx.org.id);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card">
        <h2 className="mb-2 text-lg">Marcar como aplicada</h2>
        <p className="hint mb-3">Ao confirmar, a Questeca guarda a lista de itens, a ordem, o gabarito, os pesos, o cabeçalho e o escopo desta versão. Alterações depois disso criam uma nova versão, mantendo os resultados ligados ao que os alunos receberam.</p>
        {sp.erro && <p className="err mb-3" role="alert">{sp.erro}</p>}
        {conflicts.length > 0 && <p className="card-danger mb-3 text-sm">Há {conflicts.length} item(ns) fora do escopo. <Link href={`/app/provas/${id}`}>Resolver no editor</Link>.</p>}
        {items.length === 0 ? <p className="text-sm">A prova não tem questões.</p> : (
          <Form action={createApplicationAction.bind(null, id)}>
            <div className="field"><label htmlFor="classId">Turma</label><select id="classId" name="classId" className="input" defaultValue={a.classId ?? ""} required>{cls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <Field label="Data de aplicação" name="appliedOn" type="date" defaultValue={todayISO()} required />
            <p className="hint mb-3">Para reaplicar em outra turma, crie uma aplicação separada e confira se o escopo e o modelo servem àquela turma.</p>
            <SubmitButton>Confirmar aplicação e registrar respostas</SubmitButton>
          </Form>)}
      </section>
      <div className="space-y-6">
        <section className="card"><h2 className="mb-2 text-lg">Aplicações desta avaliação</h2>
          {apps.length === 0 ? <p className="text-sm text-ink-soft">Ainda não aplicada.</p> : <table className="t"><thead><tr><th>Turma</th><th>Data</th><th>Versão</th><th></th></tr></thead><tbody>
            {apps.map(({ app, v, cname }) => <tr key={app.id}><td>{cname}</td><td>{fmtDate(app.appliedOn)}</td><td>v{v}{app.kind === "second" && <span className="badge badge-amber ml-1">2ª chamada</span>}</td><td><Link href={`/app/provas/${id}/correcao?app=${app.id}`}>Corrigir</Link></td></tr>)}
          </tbody></table>}</section>
        <section className="card"><h2 className="mb-2 text-lg">Cartões-resposta</h2>
          <p className="hint mb-2">Uma folha por aluno, com identificador da avaliação e versão. Gere depois de marcar como aplicada.</p>
          {apps.length ? <a className="btn btn-ghost" href={`/api/export/cartao?app=${apps[0].app.id}`}>Baixar cartões da última aplicação</a> : <p className="text-sm text-ink-soft">Disponível após a aplicação.</p>}</section>
        <section className="card"><h2 className="mb-2 text-lg">Segunda chamada</h2>
          <p className="hint mb-2">Mantém as habilidades-alvo, a pontuação e o tempo, buscando itens diferentes, compatíveis e liberados, sem duplicar itens e variantes da mesma questão.</p>
          {info.features.second ? <form action={createSecondCallAction.bind(null, id)}><SubmitButton className="btn btn-ghost">Criar segunda chamada</SubmitButton></form> : <p className="card-tint text-sm">Segunda chamada está disponível nos planos Professor e Escola. <Link href="/app/plano">Ver planos</Link></p>}</section>
      </div>
    </div>
  );
}
