import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/session";
import { loadPlan, updatePlanAction, sendPlanAction, deletePlanAction } from "../actions";
import { Form, SubmitButton } from "@/components/form";
import { fmtDateTime } from "@/lib/format";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Plano de aula" };

export default async function Plano({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const p = await loadPlan(ctx, id);
  if (!p) notFound();
  const c = p.content; const mine = p.authorId === ctx.user.id;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="hint no-print"><Link href="/app/planos-de-aula">Planos de aula</Link> ›</p>
      <article className="card space-y-4" aria-label="Plano de aula" data-testid="plano">
        <header className="text-center"><h1 className="text-2xl">Plano de Aula</h1><p className="hint">{c.origem === "ia" ? "Rascunho com apoio de IA — revise antes de usar" : "Rascunho por modelo — revise antes de usar"}</p></header>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {([["Escola", c.identificacao.escola], ["Turma", c.identificacao.turma], ["Disciplina", c.identificacao.disciplina], ["Professor(a)", c.identificacao.professor], ["Data", c.identificacao.data], ["Duração", `${c.identificacao.duracaoMin} min`]] as const).map(([k, v]) => <div key={k}><dt className="inline font-semibold">{k}: </dt><dd className="inline">{v}</dd></div>)}
        </dl>
        <section><h2 className="text-lg">Tema</h2><p>{c.tema}</p></section>
        <section><h2 className="text-lg">Objetivos de aprendizagem</h2><ul className="list-disc pl-5">{c.objetivos.map((x) => <li key={x}>{x}</li>)}</ul></section>
        <section><h2 className="text-lg">Habilidades</h2><ul className="list-disc pl-5">{c.habilidades.map((x) => <li key={x}>{x}</li>)}</ul></section>
        <section><h2 className="text-lg">Recursos</h2><ul className="list-disc pl-5">{c.recursos.map((x) => <li key={x}>{x}</li>)}</ul></section>
        <section><h2 className="text-lg">Desenvolvimento</h2>
          <table className="t"><thead><tr><th>Momento</th><th>Tempo</th><th>Atividade</th></tr></thead><tbody>{c.momentos.map((m) => <tr key={m.titulo}><td className="font-semibold">{m.titulo}</td><td>{m.minutos} min</td><td>{m.descricao}</td></tr>)}</tbody></table></section>
        <section><h2 className="text-lg">Avaliação</h2><p>{c.avaliacao}</p></section>
        <section><h2 className="text-lg">Adaptações e inclusão</h2><p>{c.adaptacoes}</p></section>
        <section><h2 className="text-lg">Referências</h2><ul className="list-disc pl-5">{c.referencias.map((x) => <li key={x}>{x}</li>)}</ul></section>
      </article>
      <div className="no-print flex flex-wrap items-center gap-3">
        <a className="btn" href={`/api/export/plano?id=${p.id}`}>Baixar Word (.docx)</a>
        <PrintButton />
        {mine && <form action={sendPlanAction.bind(null, p.id)}><button className="btn btn-ghost" type="submit">{p.sentAt ? "Reenviar à coordenação" : "Enviar à coordenação"}</button></form>}
        {p.sentAt && <span className="hint">Enviado em {fmtDateTime(p.sentAt)}</span>}
        {mine && <form action={deletePlanAction.bind(null, p.id)}><button className="link-btn text-danger" type="submit">Excluir</button></form>}
      </div>
      {mine && (
        <details className="card no-print"><summary className="cursor-pointer font-semibold text-brand">Editar plano</summary>
          <Form action={updatePlanAction.bind(null, p.id)} className="mt-3" toast>
            <div className="field"><label htmlFor="tema">Tema</label><input id="tema" name="tema" className="input" defaultValue={c.tema} /></div>
            <div className="field"><label htmlFor="objetivos">Objetivos (um por linha)</label><textarea id="objetivos" name="objetivos" className="input" rows={4} defaultValue={c.objetivos.join("\n")} /></div>
            <div className="field"><label htmlFor="habilidades">Habilidades (uma por linha)</label><textarea id="habilidades" name="habilidades" className="input" rows={3} defaultValue={c.habilidades.join("\n")} /></div>
            <div className="field"><label htmlFor="recursos">Recursos (um por linha)</label><textarea id="recursos" name="recursos" className="input" rows={3} defaultValue={c.recursos.join("\n")} /></div>
            <div className="field"><label htmlFor="momentos">Momentos (Título | minutos | descrição, um por linha)</label><textarea id="momentos" name="momentos" className="input" rows={6} defaultValue={c.momentos.map((m) => `${m.titulo} | ${m.minutos} | ${m.descricao}`).join("\n")} /></div>
            <div className="field"><label htmlFor="avaliacao">Avaliação</label><textarea id="avaliacao" name="avaliacao" className="input" rows={3} defaultValue={c.avaliacao} /></div>
            <div className="field"><label htmlFor="adaptacoes">Adaptações e inclusão</label><textarea id="adaptacoes" name="adaptacoes" className="input" rows={3} defaultValue={c.adaptacoes} /></div>
            <div className="field"><label htmlFor="referencias">Referências (uma por linha)</label><textarea id="referencias" name="referencias" className="input" rows={3} defaultValue={c.referencias.join("\n")} /></div>
            <SubmitButton pendingLabel="Salvando…">Salvar plano</SubmitButton>
          </Form></details>)}
    </div>
  );
}
