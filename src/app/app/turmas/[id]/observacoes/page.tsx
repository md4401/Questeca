import { eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { db } from "@/db";
import { observations, users } from "@/db/schema";
import { Form, SubmitButton } from "@/components/form";
import { DictateButton } from "@/components/dictate";
import { addObservationAction } from "../../actions";
import { fmtDate, todayISO } from "@/lib/format";
import { QUICK_TAGS, tagLabel } from "@/lib/core/opinion";

export const metadata = { title: "Ocorrências" };

export default async function Observacoes({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aluno?: string; tag?: string; q?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const studs = await classStudents(id);
  const list = await db.select({ o: observations, author: users.name }).from(observations).innerJoin(users, eq(users.id, observations.authorId)).where(eq(observations.classId, id)).orderBy(desc(observations.observedOn), desc(observations.createdAt));
  const nameOf = new Map(studs.map((s) => [s.id, s.name]));
  const termo = (sp.q ?? "").trim().toLowerCase();
  const visible = list.filter(({ o }) => o.authorId === ctx.user.id || o.visibility === "school" || o.visibility === "family" || ctx.org.role === "coordinator")
    .filter(({ o }) => !sp.aluno || (sp.aluno === "turma" ? !o.studentId : o.studentId === sp.aluno))
    .filter(({ o }) => !sp.tag || o.tags.includes(sp.tag))
    .filter(({ o }) => !termo || o.text.toLowerCase().includes(termo));
  const filtrando = !!(sp.aluno || sp.tag || termo);
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="card"><h2 className="mb-1">Ocorrências e observações</h2><p className="hint mb-3">Histórico por aluno: filtre por aluno, marcação ou palavra.</p>
        <form className="mb-4 flex flex-wrap items-end gap-2" role="search" data-testid="filtro-ocorrencias">
          <div className="field mb-0"><label htmlFor="f-aluno">Aluno</label><select id="f-aluno" name="aluno" defaultValue={sp.aluno ?? ""} className="input"><option value="">Todos</option><option value="turma">A turma toda</option>{studs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="field mb-0"><label htmlFor="f-tag">Marcação</label><select id="f-tag" name="tag" defaultValue={sp.tag ?? ""} className="input"><option value="">Todas</option>{QUICK_TAGS.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}</select></div>
          <div className="field mb-0"><label htmlFor="f-q">Buscar no texto</label><input id="f-q" name="q" defaultValue={sp.q ?? ""} className="input" /></div>
          <button className="btn btn-ghost" type="submit">Filtrar</button>{filtrando && <a className="link-btn" href="?">Limpar</a>}</form>
        {visible.length === 0 ? <p className="text-ink-soft">{filtrando ? "Nada encontrado com esses filtros." : "Nenhuma observação ainda."}</p> : <ul className="space-y-3">{visible.map(({ o, author }) => (
          <li key={o.id} className="border-b border-line pb-3"><p className="text-sm"><strong>{fmtDate(o.observedOn)}</strong> · {author} · {o.studentId ? nameOf.get(o.studentId) ?? "aluno" : "turma"} · <span className="badge badge-gray">{o.visibility === "private" ? "privada" : o.visibility === "family" ? "no boletim (família)" : "visível à escola"}</span></p>{o.tags.length > 0 && <p className="mt-1 flex flex-wrap gap-1">{o.tags.map((t) => <span key={t} className="badge badge-gray">{tagLabel(t)}</span>)}</p>}{o.text && <p className="mt-1">{o.text}</p>}</li>))}</ul>}
      </section>
      <section className="card"><h2 className="mb-2 text-lg">Registrar ocorrência</h2>
        <Form action={addObservationAction.bind(null, id)} resetOnOk>
          <div className="field"><label htmlFor="studentId">Sobre</label><select id="studentId" name="studentId" className="input"><option value="">A turma toda</option>{studs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="field"><label htmlFor="observedOn">Data</label><input id="observedOn" name="observedOn" type="date" defaultValue={todayISO()} className="input" /></div>
          <fieldset className="field"><legend className="mb-1 font-semibold">Registro rápido</legend><div className="flex flex-wrap gap-1">{QUICK_TAGS.map((q) => <label key={q.id} className="chip cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-white"><input className="sr-only" type="checkbox" name="tags" value={q.id} />{q.label}</label>)}</div><span className="hint">Marque o que se aplica; o parecer do mês usa essas marcações.</span></fieldset>
          <div className="field"><label htmlFor="text">Observação</label><textarea id="text" name="text" className="input" /><DictateButton targetId="text" /><span className="hint">Você confirma e edita o texto antes de salvar.</span></div>
          <div className="field"><label htmlFor="visibility">Acesso</label><select id="visibility" name="visibility" className="input"><option value="private">Privada (só eu)</option><option value="school">Visível à coordenação</option><option value="family">Aparece no boletim para a família</option></select></div>
          <SubmitButton>Salvar observação</SubmitButton></Form></section>
    </div>
  );
}
