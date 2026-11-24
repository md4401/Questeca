import { requireCtx } from "@/lib/session";
import { loadAssessment } from "@/lib/access";
import { Form, Field, SubmitButton } from "@/components/form";
import { saveScopeAction } from "../../actions";
import { TOPICS } from "@/lib/taxonomy";

export const metadata = { title: "Conteúdo da prova" };

const OPTIONS: [string, string][] = [["", "—"], ["f", "Vai cair"], ["p", "É pré-requisito"], ["n", "Ainda não ensinei"], ["c", "Preciso confirmar"]];

export default async function Escopo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const cur = new Map<string, string>();
  a.scope.willFall.forEach((s) => cur.set(s, "f")); a.scope.prerequisite.forEach((s) => cur.set(s, "p"));
  a.scope.notTaught.forEach((s) => cur.set(s, "n")); a.scope.confirm.forEach((s) => cur.set(s, "c"));
  const found = TOPICS.filter((t) => cur.has(t.slug));
  const rest = TOPICS.filter((t) => !cur.has(t.slug));
  const row = (t: (typeof TOPICS)[number]) => (
    <div key={t.slug} className="grid items-center gap-2 border-b border-line py-2 md:grid-cols-[1fr_220px]">
      <div><label htmlFor={`t_${t.slug}`} className="font-medium">{t.name}</label>{a.scope.sources?.[t.slug] && <p className="hint">Trecho de origem: {a.scope.sources[t.slug]}</p>}</div>
      <select id={`t_${t.slug}`} name={`t_${t.slug}`} defaultValue={cur.get(t.slug) ?? ""} className="input">{OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </div>);
  const f = a.filters;
  return (
    <div className="max-w-4xl">
      <h1>O que será cobrado?</h1>
      <p className="hint mb-4">Passos 2 e 3 de 3 · Confirme as listas. Só o que você confirmar é usado na seleção; qualquer item que exija um conteúdo de “Ainda não ensinei” perde a elegibilidade, mesmo que cite o tema no enunciado.</p>
      <Form action={saveScopeAction.bind(null, id)}>
        <section className="card mb-4">
          <h2 className="mb-1 text-lg">Conteúdos identificados</h2>
          {found.length === 0 && <p className="hint mb-2">Nenhum conteúdo foi reconhecido automaticamente. Escolha abaixo ou acrescente em “Mais tópicos”.</p>}
          {found.map(row)}
          <details className="mt-3" open={found.length === 0}><summary className="cursor-pointer font-semibold text-brand">Mais tópicos ({rest.length})</summary>{rest.map(row)}</details>
        </section>
        <section className="card mb-4">
          <h2 className="mb-3 text-lg">Parâmetros da prova</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Título" name="title" defaultValue={a.title} required />
            <Field label="Quantidade de questões" name="wantedCount" type="number" min={1} max={60} defaultValue={a.wantedCount} />
            <Field label="Duração (min)" name="durationMin" type="number" min={5} defaultValue={a.durationMin} />
            <Field label="Valor total (pontos)" name="totalPoints" defaultValue={String(Number(a.totalPoints)).replace(".", ",")} />
          </div>
          <details className="mt-2"><summary className="cursor-pointer font-semibold text-brand">Mais opções</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <fieldset className="field"><legend className="label">Fontes</legend>{["Inep", "Etec", "Fuvest", "Comvest", "Segunda Lousa"].map((i) => <label key={i} className="flex gap-2 font-normal"><input type="checkbox" name="inst" value={i} defaultChecked={!f.institutions?.length || f.institutions.includes(i)} />{i === "Segunda Lousa" ? "Banco autoral Segunda Lousa (exemplo)" : i}</label>)}<span className="hint">Desmarque todas para não filtrar por fonte.</span></fieldset>
              <fieldset className="field"><legend className="label">Dificuldade (estimada)</legend><div className="flex gap-3">{[1, 2, 3, 4, 5].map((d) => <label key={d} className="flex gap-1 font-normal"><input type="checkbox" name="diff" value={d} defaultChecked={!f.difficulty?.length || f.difficulty.includes(d)} />{d}</label>)}</div></fieldset>
              <Field label="Ano da prova de origem — de" name="yearFrom" type="number" defaultValue={f.yearFrom} />
              <Field label="Ano da prova de origem — até" name="yearTo" type="number" defaultValue={f.yearTo} />
            </div>
            <p className="hint">O ano escolar da turma personaliza a recomendação; o ano da prova de origem é um filtro independente.</p></details>
        </section>
        <SubmitButton pendingLabel="Buscando questões…">Buscar questões</SubmitButton>
      </Form>
    </div>
  );
}
