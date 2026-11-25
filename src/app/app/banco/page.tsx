import Link from "next/link";
import { figurasPorQuestao } from "@/lib/figuras";
import { Figuras } from "@/components/figuras";
import { requireCtx } from "@/lib/session";
import { toCandidate } from "@/lib/assessments";
import { parseQuery, scoreDoc, highlight } from "@/lib/core/search";
import { SUBJECTS, subjectLabel, GRADES, gradeLabel } from "@/lib/taxonomy";
import { TOPICS, normalize, topicName } from "@/lib/taxonomy";
import { STATUS_LABEL } from "@/lib/format";
import { db } from "@/db";
import { assessments, questions } from "@/db/schema";
import { and, eq, desc, or, ilike, sql, isNull, isNotNull } from "drizzle-orm";
import { addManualFormAction } from "../provas/actions";
import { checkIntegrity } from "@/lib/core/selection";
import { FlagForm } from "@/components/flag-form";
import { ProvasOficiais } from "./provas-oficiais";

export const metadata = { title: "Banco de questões" };

const BANCAS = ["Inep", "Fuvest", "Unicamp", "Unesp", "Etec", "Comvest", "Segunda Lousa"];

function BancoTabs({ aba }: { aba: "questoes" | "provas" }) {
  return (
    <div className="tabs" role="navigation" aria-label="Seções do banco">
      <a href="/app/banco" className="tab" aria-current={aba === "questoes" ? "page" : undefined}>Questões</a>
      <a href="/app/banco?aba=provas" className="tab" aria-current={aba === "provas" ? "page" : undefined}>Provas e gabaritos oficiais</a>
    </div>
  );
}

export default async function Banco({ searchParams }: { searchParams: Promise<{ aba?: string; pag?: string; inst?: string; tipo?: string; q?: string; topico?: string; fonte?: string; dif?: string; add?: string; disciplina?: string; ano?: string; serie?: string; tema?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  if (sp.aba === "provas") return <div className="space-y-5"><BancoTabs aba="provas" /><ProvasOficiais sp={sp} /></div>;
  const parsed = parseQuery(sp.q ?? "");
  const hasQuery = parsed.phrase.length > 0;
  // Pré-filtro no SQL (índice trigram em search_norm): só os candidatos vão para a pontuação em JS.
  const esc = (t: string) => t.replace(/[\\%_]/g, "\\$&");
  const termos = [...new Set([...parsed.entities.flatMap((e) => [...e.namesN, ...e.relatedN]), ...parsed.tokens])].filter((t) => t.length > 1).slice(0, 60);
  const conds = [
    or(isNull(questions.ownerOrgId), eq(questions.ownerOrgId, ctx.org.id)),
    hasQuery && termos.length ? or(...termos.map((t) => ilike(questions.searchNorm, `%${esc(t)}%`))) : undefined,
    sp.disciplina ? eq(questions.subject, sp.disciplina) : undefined,
    sp.fonte ? eq(questions.institution, sp.fonte) : undefined,
    sp.ano && Number(sp.ano) ? eq(questions.year, Number(sp.ano)) : undefined,
    sp.dif && Number(sp.dif) ? eq(questions.difficulty, Number(sp.dif)) : undefined,
    sp.serie ? sql`${questions.series} ? ${sp.serie}` : undefined,
    sp.tema ? eq(questions.tema, sp.tema) : undefined,
    sp.topico ? sql`(${questions.assessed} ? ${sp.topico} OR ${questions.prerequisites} ? ${sp.topico})` : undefined,
  ].filter(Boolean);
  const pool = hasQuery && !termos.length ? [] : await db.select().from(questions).where(conds.length ? and(...conds) : undefined)
    .orderBy(sql`(${questions.status} = 'released') DESC`, desc(questions.year)).limit(hasQuery ? 1500 : 200);
  const [facetInst, facetAnos, facetSubj, facetTemas] = await Promise.all([
    db.selectDistinct({ v: questions.institution }).from(questions),
    db.selectDistinct({ v: questions.year }).from(questions),
    db.selectDistinct({ v: questions.subject }).from(questions),
    db.selectDistinct({ v: questions.tema }).from(questions).where(isNotNull(questions.tema)),
  ]);
  const temasLista = facetTemas.map((r) => r.v as string).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const rows = pool.map((x) => {
    const m = hasQuery ? scoreDoc({ title: x.title, statement: x.statement, alternatives: x.alternatives, institution: x.institution, exam: x.exam, year: x.year, extra: `${x.assessed.map(topicName).join(" ")} ${subjectLabel(x.subject)}` }, parsed) : { score: 1, reasons: [], terms: [] as string[] };
    return { x, m };
  }).filter(({ x, m }) => {
    if (m.score <= 0) return false;
    return true;
  }).sort((a, b) => b.m.score - a.m.score || (a.x.status === "released" ? 0 : 1) - (b.x.status === "released" ? 0 : 1) || b.x.year - a.x.year);
  const total = rows.length;
  const list = rows.slice(0, 40);
  const figMap = await figurasPorQuestao(list.map(({ x }) => x.id));
  const instAll = facetInst.map((r) => r.v);
  const fontes = [...new Set([...BANCAS, ...instAll])].filter((f) => instAll.includes(f) || BANCAS.includes(f));
  const anos = facetAnos.map((r) => r.v).sort((a, b) => b - a);
  const subjects = facetSubj.map((r) => r.v);
  const active = [sp.disciplina, sp.fonte, sp.ano, sp.dif, sp.topico, sp.serie, sp.tema].filter(Boolean).length;
  const drafts = await db.select().from(assessments).where(and(eq(assessments.ownerId, ctx.user.id), eq(assessments.orgId, ctx.org.id), eq(assessments.status, "draft"))).orderBy(desc(assessments.updatedAt)).limit(5);
  const target = sp.add && drafts.find((d) => d.id === sp.add) ? sp.add : drafts[0]?.id;
  const Hl = ({ text }: { text: string }) => <>{highlight(text, rows.length ? [...new Set(list.flatMap((r) => r.m.terms))] : []).map((p, i) => p.hit ? <mark key={i} className="hl">{p.t}</mark> : <span key={i}>{p.t}</span>)}</>;
  return (
    <div className="space-y-5">
      <BancoTabs aba="questoes" />
      <div><h1>Banco de questões</h1><p className="hint">Pesquise por assunto, autor ou obra: ao buscar “Machado de Assis”, aparecem também questões sobre Dom Casmurro, Brás Cubas, Capitu e o Realismo.</p></div>
      <form role="search" className="card space-y-3">
        <div className="flex flex-wrap gap-2"><div className="field !mb-0 min-w-[16rem] flex-1"><label htmlFor="q" className="sr-only">Buscar questões</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Ex.: Machado de Assis, Revolução Francesa, juros compostos…" /></div><button className="btn" type="submit">Buscar</button></div>
        <details className="fold" open={active > 0}><summary className="!min-h-0 text-sm">Filtros{active > 0 ? ` (${active} ativos)` : ""}</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="field !mb-0"><label htmlFor="disciplina">Disciplina</label><select id="disciplina" name="disciplina" defaultValue={sp.disciplina ?? ""} className="input"><option value="">Todas</option>{subjects.map((v) => <option key={v} value={v}>{SUBJECTS.find((x) => x.value === v)?.label ?? v}</option>)}</select></div>
            <div className="field !mb-0"><label htmlFor="fonte">Banca / fonte</label><select id="fonte" name="fonte" defaultValue={sp.fonte ?? ""} className="input"><option value="">Todas</option>{fontes.map((f) => <option key={f} value={f}>{f === "Inep" ? "Enem (Inep)" : f === "Segunda Lousa" ? "Autoral Segunda Lousa" : f}</option>)}</select></div>
            <div className="field !mb-0"><label htmlFor="ano">Ano</label><select id="ano" name="ano" defaultValue={sp.ano ?? ""} className="input"><option value="">Todos</option>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
            <div className="field !mb-0"><label htmlFor="serie">Série indicada</label><select id="serie" name="serie" defaultValue={sp.serie ?? ""} className="input"><option value="">Todas</option>{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
            <div className="field !mb-0"><label htmlFor="tema">Tema</label><select id="tema" name="tema" defaultValue={sp.tema ?? ""} className="input"><option value="">Todos</option>{temasLista.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="field !mb-0"><label htmlFor="topico">Conteúdo</label><select id="topico" name="topico" defaultValue={sp.topico ?? ""} className="input"><option value="">Todos</option>{TOPICS.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}</select></div>
            <div className="field !mb-0"><label htmlFor="dif">Dificuldade</label><select id="dif" name="dif" defaultValue={sp.dif ?? ""} className="input"><option value="">Todas</option>{[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}/5</option>)}</select></div>
          </div>
          {active > 0 && <p className="mt-2 text-sm"><Link href={`/app/banco${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ""}`}>Limpar filtros</Link></p>}
        </details>
        {parsed.entities.length > 0 && <p className="text-sm text-ink-soft" data-testid="busca-entendida">Buscando por <strong>{parsed.entities.map((e) => e.label).join(", ")}</strong> e assuntos relacionados: {[...new Set(parsed.entities.flatMap((e) => e.related.slice(0, 6)))].slice(0, 6).join(", ")}…</p>}
      </form>
      <p className="hint">{total} resultado(s){total > 40 ? " (mostrando 40, os mais relevantes primeiro)" : ""}. {drafts.length ? <>Adicionar vai para: <strong>{drafts.find((d) => d.id === target)?.title}</strong>.</> : <>Crie uma <Link href="/app/provas/nova">prova</Link> para adicionar questões.</>}</p>
      <ul className="space-y-3">
        {list.map(({ x, m }) => {
          const bad = checkIntegrity(toCandidate(x));
          return (
            <li key={x.id} className="card" data-testid="resultado-questao">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><p className="text-xs font-bold text-ink-soft">{x.institution === "Segunda Lousa" ? "EXEMPLO SEGUNDA LOUSA (AUTORAL)" : `${x.institution === "Inep" ? "ENEM (INEP)" : x.institution.toUpperCase()} · ${x.exam} · ${x.year}`}{x.booklet ? ` · caderno ${x.booklet}` : ""}{x.number ? ` · questão ${x.number}` : ""} · {subjectLabel(x.subject)}</p>
                  <h2 className="text-base"><Hl text={x.title} /></h2></div>
                <span className={`badge ${x.status === "released" ? "" : x.status === "blocked" ? "badge-danger" : "badge-amber"}`}>{STATUS_LABEL[x.status]}</span>
              </div>
              <p className="mt-2 flex flex-wrap gap-1.5 text-xs" data-testid="questao-meta">{x.tema && <span className="badge badge-gray">Tema: {x.tema}</span>}{x.series.length > 0 && <span className="badge badge-gray">Indicada para: {x.series.map(gradeLabel).join(", ")}</span>}{x.origin === "ia" && <span className="badge badge-amber">Criada pela GizIA — confira o gabarito</span>}</p>
              {m.reasons.length > 0 && <p className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label="Por que esta questão apareceu">{m.reasons.map((r) => <span key={`${r.kind}${r.text}`} className={`badge ${r.kind === "cita" ? "" : "badge-gray"}`}>{r.kind === "cita" ? "Cita" : r.kind === "relacionada" ? "Relacionada" : "Contém"}: {r.text}</span>)}</p>}
              {x.statement ? <><p className="statement mt-2 whitespace-pre-line"><Hl text={x.statement} /></p><Figuras ids={figMap.get(x.id)?.map((f) => f.id)} /></> : <p className="card-amber mt-2 text-sm">Só referência: o enunciado completo não está disponível aqui. {x.licenseNote}</p>}
              {x.alternatives.length > 0 && <ol className="mt-1 text-sm">{x.alternatives.map((a) => <li key={a.key}><strong>{a.key})</strong> <Hl text={a.text} /></li>)}</ol>}
              <p className="hint mt-2">Avalia: {x.assessed.map(topicName).join(", ")}{x.prerequisites.length ? ` · Pré-requisitos: ${x.prerequisites.map(topicName).join(", ")}` : ""} · dificuldade {x.difficulty}/5 · Gabarito: {x.answer ? `${x.answer} (${x.answerSource})` : "não verificado"}.{x.sourceUrl && <> <a href={x.sourceUrl} target="_blank" rel="noreferrer">Ver fonte original</a>.</>}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                {bad && !bad.ok ? <span className="text-sm text-ink-soft" title={bad.reason}>Não pode ser incluída: {bad.reason}</span> : target ? (
                  <form action={addManualFormAction.bind(null, target, x.id)}><button className="btn btn-sm" type="submit">Adicionar à prova</button></form>) : null}
                <FlagForm questionId={x.id} />
              </div>
            </li>);
        })}
        {list.length === 0 && <li className="card empty">Nenhuma questão encontrada{sp.q ? <> para “{sp.q}”</> : null}. Tente outro termo, o nome do autor ou da obra, ou limpe os filtros. Questões de Enem, Fuvest e outras bancas entram pelo importador, com autorização de uso.</li>}
      </ul>
    </div>
  );
}
