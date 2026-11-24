import Link from "next/link";
import type { Ctx } from "@/lib/session";
import type { OrgSettings } from "@/db/schema";
import { loadGradebook, rulesFrom, cellLabel } from "@/lib/gradebook";
import { GradeGrid } from "@/components/grade-grid";
import { GradeImport } from "@/components/grade-import";
import { Form, Field, SubmitButton, ConfirmButton } from "@/components/form";
import { createGradeItemAction, deleteGradeItemAction, closePeriodAction, reopenPeriodAction } from "@/app/app/turmas/actions";
import { fmtNum } from "@/lib/format";
import { validateWeights } from "@/lib/core/grades";

/** Lançamento de notas de uma turma: atividades, grade editável, importação e fechamento. Usado na página Notas e na aba Notas da turma. */
export async function NotasPanel({ ctx, id, period, periodHref, settings, showPeriods = true, compact = false }: { ctx: Ctx; id: string; period: string; periodHref: (p: string) => string; settings?: OrgSettings; showPeriods?: boolean; compact?: boolean }) {
  const rules = rulesFrom(settings ?? ctx.org.settings);
  const gb = await loadGradebook(id, period, rules);
  const wv = validateWeights(gb.items.map((i) => ({ weight: Number(i.weight) })));
  const pend = gb.rows.reduce((a, r) => a + r.computed.ignored.filter((x) => x.why.startsWith("Lançamento")).length, 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Período" className={`flex flex-wrap gap-1 ${showPeriods ? "" : "hidden"}`}>{rules.periods.map((p) => <Link key={p} className={`btn btn-sm ${p === period ? "" : "btn-ghost"}`} aria-current={p === period ? "page" : undefined} href={periodHref(p)}>{p}</Link>)}</nav>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-ghost btn-sm" href={`/api/export/notas?turma=${id}&periodo=${encodeURIComponent(period)}`}>Exportar CSV</a>
          <a className="btn btn-ghost btn-sm" href={`/api/export/notas-pdf?turma=${id}&periodo=${encodeURIComponent(period)}`}>Resumo em PDF</a>
        </div>
      </div>
      {gb.closed && <p className="card-amber" role="status">Período fechado. As notas só mudam após reabertura autorizada.</p>}
      {!wv.ok && gb.items.length > 0 && <p className="card-amber">{wv.message}</p>}
      {wv.ok && wv.message && <p className="hint">{wv.message} Os pesos são relativos: a média usa peso ÷ soma dos pesos.</p>}

      <section className="card" id="nova-avaliacao">
        <h2 className="mb-3 text-lg">Atividades de {period}</h2>
        {gb.items.length > 0 && <ul className="mb-4 flex flex-wrap gap-2 text-sm">{gb.items.map((i) => (
          <li key={i.id} className="badge badge-gray inline-flex items-center gap-2">{i.title} · peso {fmtNum(i.weight)} · máx {fmtNum(i.maxPoints)}{i.recovery ? " · recuperação" : ""}
            {!gb.closed && <form action={deleteGradeItemAction.bind(null, id, i.id)} className="inline"><ConfirmButton message={`Excluir “${i.title}” e as notas lançadas nela?`}>×<span className="sr-only"> Excluir {i.title}</span></ConfirmButton></form>}</li>))}</ul>}
        {!gb.closed && (
          <Form action={createGradeItemAction.bind(null, id, period)} className="grid items-end gap-3 md:grid-cols-5" resetOnOk>
            <Field label="Atividade" name="title" required placeholder="Prova 1" />
            <div className="field"><label htmlFor="category">Categoria</label><select id="category" name="category" className="input"><option value="prova">Prova</option><option value="trabalho">Trabalho</option><option value="participacao">Participação</option><option value="outro">Outro</option></select></div>
            <Field label="Peso" name="weight" defaultValue="1" />
            <Field label="Pontuação máxima" name="maxPoints" defaultValue="10" />
            <div className="field"><label className="flex gap-2 font-normal"><input type="checkbox" name="recovery" />Recuperação</label><SubmitButton>Adicionar</SubmitButton></div>
          </Form>)}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between"><h2 className="text-lg">Grade de notas</h2><span className="hint">{pend} lançamento(s) pendente(s)</span></div>
        <GradeGrid
          key={`${period}-${gb.items.map((i) => i.id).join()}-${gb.rows.length}`}
          classId={id} period={period} passMark={rules.passMark} closed={gb.closed}
          items={gb.items.map((i) => ({ id: i.id, title: i.title, weight: Number(i.weight), maxPoints: Number(i.maxPoints), recovery: i.recovery }))}
          rows={gb.rows.map((r) => ({ studentId: r.student.id, name: r.student.name, cells: Object.fromEntries(r.cells.map((c) => [c.itemId, cellLabel(c)])), average: r.computed.average, partial: r.computed.partial, formula: r.computed.formula }))}
        />
      </section>

      {compact ? <details className="card fold"><summary>Importar notas (CSV ou Excel)</summary><div className="mt-3"><GradeImport classId={id} items={gb.items.map((i) => ({ id: i.id, title: i.title }))} /></div></details> : (
      <section className="card"><h2 className="mb-3 text-lg">Importar notas (CSV ou Excel)</h2><GradeImport classId={id} items={gb.items.map((i) => ({ id: i.id, title: i.title }))} /></section>
      )}

      {compact ? <details className="card fold"><summary>Fechamento do período</summary><div className="mt-3">
        <p className="text-sm text-ink-soft">Regras da escola: escala 0–{rules.scaleMax}, média {rules.passMark}, ausência {rules.absenceCounts === "zero" ? "conta como zero" : "não conta"}, não entrega {rules.notDeliveredCounts === "zero" ? "conta como zero" : "não conta"}, recuperação: {({ none: "nenhuma", replace_if_higher: "substitui pela maior nota", average: "média com a nota original", independent: "atividade independente" })[rules.recovery]}. A equipe escolar continua responsável por promoção e registros oficiais.</p>
        {pend > 0 && !gb.closed && <p className="card-amber mt-3 text-sm">Há {pend} lançamento(s) pendente(s). Você pode fechar mesmo assim; as linhas pendentes ficam identificadas.</p>}
        <div className="mt-3">
          {gb.closed ? (
            <Form action={reopenPeriodAction.bind(null, id, period)}><Field label="Motivo da reabertura" name="reason" required /><SubmitButton className="btn btn-ghost">Reabrir período</SubmitButton></Form>
          ) : (
            <form action={closePeriodAction.bind(null, id, period)}><ConfirmButton className="btn" message={`Fechar ${period}? As notas ficam travadas até a reabertura.`}>Confirmar e fechar período</ConfirmButton></form>
          )}
        </div>
</div></details> : (
      <section className="card">
        <h2 className="mb-2 text-lg">Fechamento do período</h2>
        <p className="text-sm text-ink-soft">Regras da escola: escala 0–{rules.scaleMax}, média {rules.passMark}, ausência {rules.absenceCounts === "zero" ? "conta como zero" : "não conta"}, não entrega {rules.notDeliveredCounts === "zero" ? "conta como zero" : "não conta"}, recuperação: {({ none: "nenhuma", replace_if_higher: "substitui pela maior nota", average: "média com a nota original", independent: "atividade independente" })[rules.recovery]}. A equipe escolar continua responsável por promoção e registros oficiais.</p>
        {pend > 0 && !gb.closed && <p className="card-amber mt-3 text-sm">Há {pend} lançamento(s) pendente(s). Você pode fechar mesmo assim; as linhas pendentes ficam identificadas.</p>}
        <div className="mt-3">
          {gb.closed ? (
            <Form action={reopenPeriodAction.bind(null, id, period)}><Field label="Motivo da reabertura" name="reason" required /><SubmitButton className="btn btn-ghost">Reabrir período</SubmitButton></Form>
          ) : (
            <form action={closePeriodAction.bind(null, id, period)}><ConfirmButton className="btn" message={`Fechar ${period}? As notas ficam travadas até a reabertura.`}>Confirmar e fechar período</ConfirmButton></form>
          )}
        </div>
      </section>
      )}
    </div>
  );
}
