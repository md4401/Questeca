import Link from "next/link";
import { EditorTabs } from "@/components/editor-tabs";
import { eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { loadAssessment } from "@/lib/access";
import { getItems, buildMap, conflictsFor, swapAlternatives, loadPool, toCandidate } from "@/lib/assessments";
import { db } from "@/db";
import { assessmentHistory, classes } from "@/db/schema";
import { Form, Field, SubmitButton, ConfirmButton } from "@/components/form";
import { pinAction, moveAction, removeItemAction, replaceItemAction, addManualFormAction, pointsAction, redistributePointsAction, updateMetaAction, undoAction, restoreAction, confirmConflictAction, deleteAssessmentAction } from "../actions";
import { topicName } from "@/lib/taxonomy";
import { fmtNum, fmtDateTime } from "@/lib/format";
import { evaluate } from "@/lib/core/selection";

export const metadata = { title: "Editor da prova" };

export default async function Editor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ achou?: string; pedido?: string; faltam?: string; trocar?: string; erro?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const items = await getItems(id);
  const map = buildMap(items, a);
  const conflicts = await conflictsFor(id, a.scope);
  const conflictIds = new Set(conflicts.map((c) => c.id));
  const hist = await db.select().from(assessmentHistory).where(eq(assessmentHistory.assessmentId, id)).orderBy(desc(assessmentHistory.createdAt)).limit(8);
  const [cls] = a.classId ? await db.select().from(classes).where(eq(classes.id, a.classId)).limit(1) : [];
  const swaps = sp.trocar ? await swapAlternatives(id, sp.trocar, a) : [];
  const pool = await loadPool("matematica", ctx.org.id);
  const inExam = new Set(items.map((i) => i.q.id));
  const addable = pool.filter((q) => !inExam.has(q.id) && evaluate(toCandidate(q), { ...a.scope, willFall: a.scope.willFall }).ok).slice(0, 40);

  let parentCompare: { title: string; n: number; minutes: number; avgDiff: number } | null = null;
  if (a.parentId) {
    const pitems = await getItems(a.parentId);
    parentCompare = { title: "Original", n: pitems.length, minutes: Math.round(pitems.reduce((s, i) => s + i.q.estSeconds, 0) / 60), avgDiff: pitems.reduce((s, i) => s + i.q.difficulty, 0) / (pitems.length || 1) };
  }
  const myDiff = items.reduce((s, i) => s + i.q.difficulty, 0) / (items.length || 1);
  const found = sp.achou ? Number(sp.achou) : null;
  const wanted = sp.pedido ? Number(sp.pedido) : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>{a.title}</h1>
          <p className="hint">{cls ? `${cls.name} · ` : ""}{items.length} questão(ões) · soma {fmtNum(map.points)} pts · {map.minutes} min estimados · <span role="status" className="ok">Salvo automaticamente</span> (revisão {a.revision})</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={undoAction.bind(null, id)}><button className="btn btn-ghost btn-sm" type="submit" disabled={!hist.length}>Desfazer</button></form>
          <Link className="btn btn-ghost btn-sm" href={`/app/provas/${id}/escopo`}>Refazer sugestões</Link>
          <Link className="btn" href={`/app/provas/${id}/previa`}>Ver prévia</Link>
        </div>
      </div>

      {sp.erro && <p className="card-danger mb-4" role="alert">{sp.erro}</p>}
      {found !== null && wanted !== null && found < wanted && (
        <div className="card-amber mb-4" role="status">
          <p className="font-bold">Encontramos {found} de {wanted} questões compatíveis.</p>
          {sp.faltam && <p className="text-sm">Temas ainda descobertos: {sp.faltam.split(",").map(topicName).join(", ")}.</p>}
          <p className="mt-1 text-sm">Itens que exigem conteúdo fora do escopo confirmado ficaram de fora. O escopo só muda quando você confirmar a alteração.</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm"><Link className="btn btn-sm" href={`/app/provas/${id}`}>Usar as {found}</Link><Link className="btn btn-ghost btn-sm" href={`/app/provas/${id}/escopo#fontes`}>Ampliar fontes</Link><Link className="btn btn-ghost btn-sm" href={`/app/provas/${id}/escopo`}>Ajustar conteúdos</Link></div>
        </div>)}
      {found === 0 && <p className="card-amber mb-4">Nenhuma questão liberada e compatível foi encontrada. Ajuste os conteúdos ou adicione manualmente pelo <Link href="/app/banco">banco</Link>.</p>}
      {conflicts.length > 0 && (
        <div className="card-danger mb-4" role="alert">
          <p className="font-bold">Mudança de escopo: {conflicts.length} item(ns) exigem conteúdo que saiu do escopo.</p>
          <p className="text-sm">Os itens permanecem no rascunho para revisão, mas a versão de aplicação fica bloqueada até você substituí-los ou confirmar o novo escopo.</p>
        </div>)}
      {parentCompare && (
        <div className="card-tint mb-4 text-sm"><strong>Comparação com a prova original:</strong> {parentCompare.n} vs {items.length} itens · {parentCompare.minutes} vs {map.minutes} min · dificuldade média {fmtNum(parentCompare.avgDiff, 1)} vs {fmtNum(myDiff, 1)}. Os itens são diferentes dos originais.</div>)}

      <EditorTabs count={items.length} main={<>
          {items.length === 0 && <div className="card"><p>A prova ainda não tem questões. Refaça a busca ou adicione manualmente.</p></div>}
          {items.map(({ item, q }, idx) => (
            <article key={item.id} className={`card ${conflictIds.has(item.id) ? "border-danger" : ""}`} aria-label={`Questão ${idx + 1}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-xs font-bold text-ink-soft">QUESTÃO {String(idx + 1).padStart(2, "0")} · {q.institution === "Questeca" ? "Exemplo Questeca (autoral)" : `${q.institution} ${q.exam !== q.institution ? q.exam : ""} ${q.year}`} · {fmtNum(item.points)} pt{item.pinned && <span className="badge ml-2">fixada</span>}{item.manual && <span className="badge badge-gray ml-1">manual</span>}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link className="link-btn" href={`/app/provas/${id}?trocar=${item.id}#alt-${item.id}`}>Trocar</Link>
                  <form action={pinAction.bind(null, id, item.id, !item.pinned)}><button className="link-btn" type="submit">{item.pinned ? "Desafixar" : "Fixar"}</button></form>
                  <form action={moveAction.bind(null, id, item.id, "up")}><button className="link-btn" type="submit" disabled={idx === 0} aria-label={`Mover questão ${idx + 1} para cima`}>↑</button></form>
                  <form action={moveAction.bind(null, id, item.id, "down")}><button className="link-btn" type="submit" disabled={idx === items.length - 1} aria-label={`Mover questão ${idx + 1} para baixo`}>↓</button></form>
                  <form action={removeItemAction.bind(null, id, item.id)}><ConfirmButton message="Remover esta questão da prova?">Remover</ConfirmButton></form>
                </div>
              </div>
              <p className="statement mt-2 whitespace-pre-line">{q.statement}</p>
              <ol className="mt-2 space-y-1">{q.alternatives.map((alt) => <li key={alt.key} className="statement text-base"><strong>{alt.key})</strong> {alt.text}</li>)}</ol>
              <p className="hint mt-3">{item.reason}</p>
              {conflictIds.has(item.id) && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span className="err">{conflicts.find((c) => c.id === item.id)?.reason}</span>
                  <form action={confirmConflictAction.bind(null, id, item.id)}><button className="link-btn" type="submit">Confirmar novo escopo para este item</button></form></div>)}
              <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold text-brand">Ver detalhes</summary>
                <dl className="mt-2 grid gap-1 md:grid-cols-2">
                  <div><dt className="label">Fonte</dt><dd>{q.exam} · {q.year}{q.booklet ? ` · caderno ${q.booklet}` : ""}{q.number ? ` · questão ${q.number}` : ""}{q.page ? ` · p. ${q.page}` : ""}</dd></div>
                  <div><dt className="label">Gabarito (só professor)</dt><dd><strong>{q.answer}</strong> <span className="hint">({q.answerSource})</span></dd></div>
                  <div><dt className="label">Avalia</dt><dd>{q.assessed.map(topicName).join(", ")}</dd></div>
                  <div><dt className="label">Pré-requisitos</dt><dd>{q.prerequisites.length ? q.prerequisites.map(topicName).join(", ") : "—"}</dd></div>
                  <div><dt className="label">Tempo e dificuldade (estimados)</dt><dd>{Math.round(q.estSeconds / 60 * 10) / 10} min · nível {q.difficulty}/5</dd></div>
                  <div><dt className="label">Referência original</dt><dd>{q.sourceUrl ? <a href={q.sourceUrl} target="_blank" rel="noreferrer">Abrir fonte</a> : "Banco autoral da Questeca"}</dd></div>
                </dl></details>
              {sp.trocar === item.id && (
                <div id={`alt-${item.id}`} className="mt-3 rounded-lg border border-line bg-brand-tint p-3">
                  <p className="font-bold">Alternativas para trocar</p>
                  {swaps.length === 0 && <p className="text-sm">Não há outra questão elegível no escopo atual.</p>}
                  <ul className="mt-2 space-y-2">{swaps.map(({ q: s, diff }) => (
                    <li key={s.id} className="rounded bg-white p-2 text-sm"><p className="statement text-base">{s.statement}</p><p className="hint">{diff}</p>
                      <form action={replaceItemAction.bind(null, id, item.id, s.id)}><button className="btn btn-sm mt-1" type="submit">Usar esta</button></form></li>))}</ul>
                  <Link className="link-btn" href={`/app/provas/${id}`}>Cancelar</Link>
                </div>)}
            </article>
          ))}

          <section className="card" aria-labelledby="add-h">
            <h2 id="add-h" className="mb-2 text-lg">Adicionar manualmente</h2>
            {addable.length === 0 ? <p className="text-sm text-ink-soft">Nenhuma outra questão elegível no escopo atual. Veja o <Link href="/app/banco">banco</Link>.</p> : (
              <ul className="max-h-72 space-y-2 overflow-auto text-sm">{addable.map((q) => (
                <li key={q.id} className="flex items-start justify-between gap-3 border-b border-line pb-2"><span><strong>{q.title}</strong> <span className="hint">· {q.assessed.map(topicName).join(", ")} · nível {q.difficulty}</span></span>
                  <form action={addManualFormAction.bind(null, id, q.id)}><button className="link-btn" type="submit">Adicionar</button></form></li>))}</ul>)}
            <Link className="link-btn mt-2 inline-block" href="/app/banco">Abrir busca completa do banco</Link>
          </section>
        </>} side={<>
          <section className="card-tint" aria-labelledby="mapa-h">
            <h2 id="mapa-h" className="mb-2 text-lg">Mapa da prova</h2>
            <p className="text-sm font-bold">Por conteúdo</p>
            <ul className="mb-2 text-sm">{[...map.byTopic].map(([s, n]) => <li key={s}>{n} × {topicName(s)}</li>)}{map.byTopic.size === 0 && <li className="text-ink-soft">—</li>}</ul>
            <p className="text-sm font-bold">Por área</p>
            <ul className="mb-2 text-sm">{[...map.byArea].map(([s, n]) => <li key={s}>{n} × {s}</li>)}</ul>
            <p className="text-sm">Formato: {map.format.multipla} múltipla escolha · {map.format.discursiva} discursiva(s)</p>
            {map.alerts.map((al) => <p key={al} className="mt-2 rounded bg-amber-tint p-2 text-sm text-amber" role="alert">⚠ {al}</p>)}
            <Link className="btn mt-3 w-full" href={`/app/provas/${id}/previa`}>Ver prévia</Link>
          </section>
          <section className="card"><h2 className="mb-2 text-lg">Título, duração e total</h2>
            <Form action={updateMetaAction.bind(null, id)}>
              <Field label="Título" name="title" defaultValue={a.title} required />
              <Field label="Duração (min)" name="durationMin" type="number" defaultValue={a.durationMin} />
              <Field label="Total de pontos" name="totalPoints" defaultValue={String(Number(a.totalPoints)).replace(".", ",")} />
              <SubmitButton>Salvar</SubmitButton></Form></section>
          <section className="card"><h2 className="mb-2 text-lg">Valor de cada questão</h2>
            <Form action={pointsAction.bind(null, id)}>
              {items.map(({ item }, i) => <div key={item.id} className="field"><label htmlFor={`pts_${item.id}`}>Questão {i + 1}</label><input id={`pts_${item.id}`} name={`pts_${item.id}`} defaultValue={String(Number(item.points)).replace(".", ",")} className="input" inputMode="decimal" /></div>)}
              <SubmitButton>Salvar valores</SubmitButton></Form>
            <form action={redistributePointsAction.bind(null, id)} className="mt-2"><button className="link-btn" type="submit">Distribuir igualmente</button></form></section>
          <section className="card"><h2 className="mb-2 text-lg">Histórico</h2>
            {hist.length === 0 ? <p className="text-sm text-ink-soft">Sem alterações registradas.</p> : <ul className="space-y-1 text-sm">{hist.map((h) => <li key={h.id} className="flex items-center justify-between gap-2"><span>{h.label} <span className="hint">{fmtDateTime(h.createdAt)}</span></span><form action={restoreAction.bind(null, id, h.id)}><button className="link-btn" type="submit">Restaurar</button></form></li>)}</ul>}</section>
          <form action={deleteAssessmentAction.bind(null, id)}><ConfirmButton className="link-btn text-danger" message="Excluir este rascunho?">Excluir prova</ConfirmButton></form>
        </>} />
    </div>
  );
}
