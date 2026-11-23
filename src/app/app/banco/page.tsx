import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { loadPool, toCandidate } from "@/lib/assessments";
import { TOPICS, normalize, topicName } from "@/lib/taxonomy";
import { STATUS_LABEL } from "@/lib/format";
import { db } from "@/db";
import { assessments } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { addManualFormAction } from "../provas/actions";
import { checkIntegrity } from "@/lib/core/selection";
import { FlagForm } from "@/components/flag-form";

export const metadata = { title: "Banco de questões" };

export default async function Banco({ searchParams }: { searchParams: Promise<{ q?: string; topico?: string; fonte?: string; dif?: string; add?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const pool = await loadPool("matematica");
  const q = normalize(sp.q ?? "");
  let list = pool.filter((x) => {
    if (sp.topico && !x.assessed.includes(sp.topico) && !x.prerequisites.includes(sp.topico)) return false;
    if (sp.fonte && x.institution !== sp.fonte) return false;
    if (sp.dif && x.difficulty !== Number(sp.dif)) return false;
    if (q) {
      const hay = normalize(`${x.title} ${x.statement ?? ""} ${x.assessed.map(topicName).join(" ")} ${x.institution} ${x.exam} ${x.year}`);
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }).sort((a, b) => (a.status === "released" ? 0 : 1) - (b.status === "released" ? 0 : 1) || b.year - a.year);
  const total = list.length;
  list = list.slice(0, 60);
  const drafts = await db.select().from(assessments).where(and(eq(assessments.ownerId, ctx.user.id), eq(assessments.orgId, ctx.org.id), eq(assessments.status, "draft"))).orderBy(desc(assessments.updatedAt)).limit(5);
  const target = sp.add && drafts.find((d) => d.id === sp.add) ? sp.add : drafts[0]?.id;
  return (
    <div>
      <h1 className="mb-1">Banco de questões</h1>
      <p className="hint mb-4">Acervo persistente de questões reais, organizado fora da conversa com a IA. Cada item mostra a procedência e a condição de uso.</p>
      <form className="card mb-6 grid items-end gap-3 md:grid-cols-5" role="search">
        <div className="field mb-0 md:col-span-2"><label htmlFor="q">Buscar por texto ou assunto</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="desconto, juros, triângulo…" /></div>
        <div className="field mb-0"><label htmlFor="topico">Conteúdo</label><select id="topico" name="topico" defaultValue={sp.topico ?? ""} className="input"><option value="">Todos</option>{TOPICS.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select></div>
        <div className="field mb-0"><label htmlFor="fonte">Fonte</label><select id="fonte" name="fonte" defaultValue={sp.fonte ?? ""} className="input"><option value="">Todas</option>{["Inep", "Etec", "Fuvest", "Comvest", "Questeca"].map((f) => <option key={f}>{f}</option>)}</select></div>
        <div className="flex gap-2"><button className="btn" type="submit">Buscar</button></div>
      </form>
      <p className="hint mb-3">{total} resultado(s){total > 60 ? " (mostrando 60)" : ""}. {drafts.length ? <>Adicionar vai para: <strong>{drafts.find((d) => d.id === target)?.title}</strong>.</> : <>Crie uma <Link href="/app/provas/nova">prova</Link> para adicionar itens.</>}</p>
      <ul className="space-y-3">
        {list.map((x) => {
          const bad = checkIntegrity(toCandidate(x));
          return (
            <li key={x.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="text-xs font-bold text-ink-soft">{x.institution === "Questeca" ? "EXEMPLO QUESTECA (AUTORAL)" : `${x.institution} · ${x.exam} · ${x.year}`}{x.booklet ? ` · caderno ${x.booklet}` : ""}{x.number ? ` · questão ${x.number}` : ""}</p>
                  <h2 className="text-base">{x.title}</h2></div>
                <span className={`badge ${x.status === "released" ? "" : x.status === "blocked" ? "badge-danger" : "badge-amber"}`}>{STATUS_LABEL[x.status]}</span>
              </div>
              {x.statement ? <p className="statement mt-2 whitespace-pre-line">{x.statement}</p> : <p className="card-amber mt-2 text-sm">Só referência: o enunciado completo não está disponível aqui. {x.licenseNote}</p>}
              {x.alternatives.length > 0 && <ol className="mt-1 text-sm">{x.alternatives.map((a) => <li key={a.key}><strong>{a.key})</strong> {a.text}</li>)}</ol>}
              <p className="hint mt-2">Avalia: {x.assessed.map(topicName).join(", ")}{x.prerequisites.length ? ` · Pré-requisitos: ${x.prerequisites.map(topicName).join(", ")}` : ""} · dificuldade {x.difficulty}/5 (estimada) · ~{Math.round(x.estSeconds / 60 * 10) / 10} min</p>
              <p className="hint">Gabarito: {x.answer ? `${x.answer} (${x.answerSource})` : "não verificado"}.{x.sourceUrl && <> <a href={x.sourceUrl} target="_blank" rel="noreferrer">Ver fonte original</a>.</>}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                {bad && !bad.ok ? <span className="text-sm text-ink-soft" title={bad.reason}>Não pode ser incluída: {bad.reason}</span> : target ? (
                  <form action={addManualFormAction.bind(null, target, x.id)}><button className="btn btn-sm" type="submit">Adicionar à prova</button></form>) : null}
                <FlagForm questionId={x.id} />
              </div>
            </li>);
        })}
        {list.length === 0 && <li className="card">Nenhuma questão encontrada para esses filtros.</li>}
      </ul>
    </div>
  );
}
