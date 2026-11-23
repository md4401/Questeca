import Link from "next/link";
import { eq, desc, count, sql, and, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { questions, questionFlags, postFlags, posts, users, orgs, subscriptions, tickets, demoRequests, events, userBlocks, auditLog, questionChanges } from "@/db/schema";
import { Form, SubmitButton, Field } from "@/components/form";
import { setQuestionStatusAction, correctAnswerAction, voidQuestionAction, resolveFlagAction, importQuestionsAction, moderateAction, unblockUserAction, setSchoolContractAction, setTicketStatusAction } from "./actions";
import { STATUS_LABEL, fmtDateTime } from "@/lib/format";
import { topicName } from "@/lib/taxonomy";

export const metadata = { title: "Área interna" };
const TABS = [["acervo", "Acervo e curadoria"], ["ocorrencias", "Ocorrências"], ["moderacao", "Moderação"], ["assinaturas", "Assinaturas"], ["suporte", "Suporte"], ["piloto", "Indicadores do piloto"], ["saude", "Saúde e auditoria"]] as const;

const COVERAGE = [["Inep / Enem", "Importar aplicações e gabaritos por edição, dia e caderno autorizados."], ["Centro Paula Souza / Etec", "Vestibulinho alinhado aos anos finais do EF."], ["Fuvest / USP", "Itens por edição e fase, com revisão de adequação às séries."], ["Comvest / Unicamp", "Registrar condições de reprodução e anexos de terceiros."]];

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : "acervo";
  return (
    <div>
      <h1 className="mb-4">Operação interna</h1>
      <nav className="tabs" aria-label="Seções">{TABS.map(([t, l]) => <Link key={t} href={`/admin?tab=${t}`} className="tab" aria-current={tab === t ? "page" : undefined}>{l}</Link>)}</nav>
      {tab === "acervo" && <Acervo status={sp.status} />}
      {tab === "ocorrencias" && <Ocorrencias />}
      {tab === "moderacao" && <Moderacao />}
      {tab === "assinaturas" && <Assinaturas />}
      {tab === "suporte" && <Suporte />}
      {tab === "piloto" && <Piloto />}
      {tab === "saude" && <Saude />}
    </div>
  );
}

async function Acervo({ status }: { status?: string }) {
  const all = await db.select().from(questions).orderBy(desc(questions.createdAt));
  const by = (s: string) => all.filter((q) => q.status === s).length;
  const list = all.filter((q) => !status || q.status === status).slice(0, 80);
  const byInst = new Map<string, { n: number; released: number; years: Set<number> }>();
  all.forEach((q) => { const c = byInst.get(q.institution) ?? { n: 0, released: 0, years: new Set() }; c.n++; if (q.status === "released") c.released++; c.years.add(q.year); byInst.set(q.institution, c); });
  return (
    <div className="space-y-6">
      <section className="card"><h2 className="mb-2 text-lg">Cobertura do acervo</h2>
        <table className="t"><thead><tr><th>Instituição</th><th>Itens</th><th>Liberados</th><th>Anos</th></tr></thead><tbody>
          {[...byInst].map(([k, v]) => <tr key={k}><td>{k}</td><td>{v.n}</td><td>{v.released}</td><td>{[...v.years].sort().join(", ")}</td></tr>)}
          {COVERAGE.filter(([n]) => ![...byInst.keys()].some((k) => n.startsWith(k))).map(([n, d]) => <tr key={n}><td>{n}</td><td colSpan={3} className="hint">Não importado — {d}</td></tr>)}
        </tbody></table>
        <p className="hint mt-2">Em curadoria: {by("curation")} · Só referência: {by("reference_only")} · Liberados: {by("released")} · Em revisão: {by("in_review")} · Bloqueados: {by("blocked")}</p></section>
      <section className="card"><h2 className="mb-2 text-lg">Importar lote (JSON)</h2>
        <p className="hint mb-2">Campos mínimos: institution, exam, year, title. Recomendados: booklet, number, page, sourceUrl, statement, alternatives [{"{key,text}"}], answer, answerSource, licenseNote, assessed [slugs], prerequisites [slugs], difficulty, estSeconds. Os itens entram “em curadoria”; liberar exige enunciado, gabarito e licença registrada.</p>
        <Form action={importQuestionsAction}><textarea name="json" className="input" style={{ minHeight: 140, fontFamily: "monospace" }} placeholder='[{"institution":"Inep","exam":"Enem","year":2013,"title":"…"}]' /><SubmitButton>Importar</SubmitButton></Form></section>
      <section><div className="mb-2 flex flex-wrap gap-2 text-sm">{[["", "Todos"], ["curation", "Em curadoria"], ["reference_only", "Só referência"], ["released", "Liberados"], ["in_review", "Em revisão"], ["blocked", "Bloqueados"]].map(([v, l]) => <Link key={v} className={`btn btn-sm ${(status ?? "") === v ? "" : "btn-ghost"}`} href={`/admin?tab=acervo${v ? `&status=${v}` : ""}`}>{l}</Link>)}</div>
        <ul className="space-y-3">{list.map((q) => (
          <li key={q.id} className="card"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-ink-soft">{q.institution} · {q.exam} · {q.year}{q.booklet ? ` · cad. ${q.booklet}` : ""}{q.number ? ` · q.${q.number}` : ""}{q.isDemo ? " · exemplo" : ""}</p><h3>{q.title}</h3><p className="hint">{q.assessed.map(topicName).join(", ")} · gabarito {q.answer ?? "—"} · v{q.version}</p></div><span className={`badge ${q.status === "released" ? "" : "badge-amber"}`}>{STATUS_LABEL[q.status]}</span></div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">{(["released", "in_review", "blocked", "curation", "reference_only"] as const).filter((s) => s !== q.status).map((s) => <form key={s} action={setQuestionStatusAction.bind(null, q.id, s)}><button className="link-btn" type="submit">→ {STATUS_LABEL[s]}</button></form>)}
              <form action={voidQuestionAction.bind(null, q.id, !q.voided)}><button className="link-btn" type="submit">{q.voided ? "Desfazer anulação" : "Marcar anulada"}</button></form></div>
            <details className="mt-2 text-sm"><summary className="cursor-pointer font-semibold text-brand">Retificar gabarito</summary><Form action={correctAnswerAction.bind(null, q.id)} className="mt-2 grid items-end gap-2 md:grid-cols-4"><Field label="Nova resposta" name="answer" id={`answer-${q.id}`} /><div className="md:col-span-2"><Field label="Evidência / motivo" name="reason" id={`reason-${q.id}`} /></div><SubmitButton>Retificar e avisar</SubmitButton></Form></details></li>))}
          {list.length === 0 && <li className="card">Nenhum item.</li>}</ul></section>
    </div>
  );
}

async function Ocorrencias() {
  const rows = await db.select({ f: questionFlags, q: questions.title, who: users.name }).from(questionFlags).innerJoin(questions, eq(questions.id, questionFlags.questionId)).innerJoin(users, eq(users.id, questionFlags.reporterId)).orderBy(desc(questionFlags.createdAt)).limit(50);
  const changes = await db.select().from(questionChanges).orderBy(desc(questionChanges.createdAt)).limit(10);
  return (
    <div className="space-y-6"><section className="card"><h2 className="mb-2 text-lg">Denúncias de erro e direito autoral</h2>
      {rows.length === 0 ? <p className="text-sm text-ink-soft">Nenhuma ocorrência.</p> : <ul className="space-y-3">{rows.map(({ f, q, who }) => <li key={f.id} className="border-b border-line pb-3"><p><strong>{q}</strong> <span className={`badge ${f.status === "open" ? "badge-amber" : "badge-gray"}`}>{f.status}</span></p><p className="text-sm">Motivo: {f.reason}{f.detail ? ` — ${f.detail}` : ""} · {who} · {fmtDateTime(f.createdAt)}</p>
        {f.status === "open" && <div className="mt-1 flex gap-3"><Form action={resolveFlagAction.bind(null, f.id, "resolved")}><input name="note" className="input" placeholder="Resolução" aria-label="Resolução" style={{ minHeight: 34 }} /><SubmitButton className="btn btn-sm mt-1">Resolver</SubmitButton></Form><Form action={resolveFlagAction.bind(null, f.id, "dismissed")}><input type="hidden" name="note" value="Sem procedência" /><SubmitButton className="btn btn-ghost btn-sm">Descartar</SubmitButton></Form></div>}</li>)}</ul>}</section>
      <section className="card"><h2 className="mb-2 text-lg">Alterações recentes no acervo</h2><ul className="text-sm">{changes.map((c) => <li key={c.id}>{fmtDateTime(c.createdAt)} — {c.kind} {JSON.stringify(c.before)} → {JSON.stringify(c.after)}</li>)}</ul></section></div>
  );
}

async function Moderacao() {
  const rows = await db.select({ f: postFlags, post: posts.title, who: users.name }).from(postFlags).leftJoin(posts, eq(posts.id, postFlags.postId)).innerJoin(users, eq(users.id, postFlags.reporterId)).where(eq(postFlags.status, "open")).orderBy(desc(postFlags.createdAt)).limit(50);
  const blocked = await db.select({ b: userBlocks, name: users.name }).from(userBlocks).innerJoin(users, eq(users.id, userBlocks.userId));
  const prio = (r: string) => (r === "dados_alunos" ? 0 : r === "direitos" ? 1 : 2);
  rows.sort((a, b) => prio(a.f.reason) - prio(b.f.reason));
  return (
    <div className="space-y-6"><section className="card"><h2 className="mb-2 text-lg">Fila de denúncias (exposição de estudantes e direitos primeiro)</h2>
      {rows.length === 0 ? <p className="text-sm text-ink-soft">Fila vazia.</p> : <ul className="space-y-3">{rows.map(({ f, post, who }) => <li key={f.id} className="border-b border-line pb-3"><p><strong>{post ?? "(comentário)"}</strong> <span className={`badge ${f.reason === "dados_alunos" ? "badge-danger" : "badge-amber"}`}>{f.reason}</span></p><p className="text-sm hint">Denunciado por {who} · {fmtDateTime(f.createdAt)}</p>
        <div className="mt-1 flex flex-wrap gap-2"><Form action={moderateAction.bind(null, f.id, "hide")}><SubmitButton className="btn btn-sm">Ocultar</SubmitButton></Form><Form action={moderateAction.bind(null, f.id, "block")}><SubmitButton className="btn btn-danger btn-sm">Ocultar e bloquear autor</SubmitButton></Form><Form action={moderateAction.bind(null, f.id, "dismiss")}><SubmitButton className="btn btn-ghost btn-sm">Descartar</SubmitButton></Form></div></li>)}</ul>}</section>
      <section className="card"><h2 className="mb-2 text-lg">Usuários bloqueados</h2>{blocked.length === 0 ? <p className="text-sm text-ink-soft">Nenhum.</p> : <ul className="text-sm">{blocked.map(({ b, name }) => <li key={b.userId} className="flex items-center gap-3">{name} — {b.reason}<form action={unblockUserAction.bind(null, b.userId)}><button className="link-btn" type="submit">Reverter (recurso aceito)</button></form></li>)}</ul>}</section></div>
  );
}

async function Assinaturas() {
  const rows = await db.select({ s: subscriptions, org: orgs.name, kind: orgs.kind }).from(subscriptions).innerJoin(orgs, eq(orgs.id, subscriptions.orgId)).orderBy(desc(subscriptions.createdAt)).limit(100);
  const demos = await db.select().from(demoRequests).orderBy(desc(demoRequests.createdAt)).limit(20);
  return (
    <div className="space-y-6"><section className="card overflow-x-auto"><h2 className="mb-2 text-lg">Assinaturas</h2>
      <table className="t"><thead><tr><th>Conta</th><th>Plano</th><th>Situação</th><th>Vigência</th><th>Origem</th><th>Contrato escolar</th></tr></thead><tbody>
        {rows.map(({ s, org, kind }) => <tr key={s.id}><td>{org} <span className="hint">({kind})</span></td><td>{s.plan}</td><td><span className={`badge ${s.status === "active" ? "" : "badge-amber"}`}>{s.status}</span></td><td>{fmtDateTime(s.periodEnd)}</td><td>{s.provider}</td>
          <td>{kind === "school" && <Form action={setSchoolContractAction.bind(null, s.orgId)} className="flex flex-wrap items-end gap-1"><input name="months" defaultValue="12" className="input" style={{ width: 60, minHeight: 32 }} aria-label="Meses" /><input name="assemblies" defaultValue="1000" className="input" style={{ width: 80, minHeight: 32 }} aria-label="Montagens" /><input name="classes" defaultValue="200" className="input" style={{ width: 70, minHeight: 32 }} aria-label="Turmas" /><input name="cards" defaultValue="20000" className="input" style={{ width: 80, minHeight: 32 }} aria-label="Cartões" /><SubmitButton className="btn btn-sm">Aplicar</SubmitButton></Form>}</td></tr>)}</tbody></table></section>
      <section className="card"><h2 className="mb-2 text-lg">Pedidos de demonstração/contratação</h2><ul className="space-y-2 text-sm">{demos.map((d) => <li key={d.id}><strong>{d.school}</strong> — {d.name} ({d.email}) · {fmtDateTime(d.createdAt)}{d.message && <span className="hint"> — {d.message.slice(0, 160)}</span>}</li>)}{demos.length === 0 && <li className="text-ink-soft">Nenhum.</li>}</ul></section></div>
  );
}

async function Suporte() {
  const rows = await db.select({ t: tickets, who: users.name, email: users.email }).from(tickets).innerJoin(users, eq(users.id, tickets.userId)).orderBy(desc(tickets.createdAt)).limit(60);
  return (
    <section className="card"><h2 className="mb-2 text-lg">Chamados</h2>
      <p className="hint mb-2">Mostramos só o registro operacional mínimo. Dados pedagógicos exigem autorização específica do professor/escola, com acesso temporário.</p>
      <ul className="space-y-3">{rows.map(({ t, who, email }) => <li key={t.id} className="border-b border-line pb-3"><p><strong>{t.subject}</strong> <span className="badge badge-gray">{t.status}</span></p><p className="text-sm">{who} ({email}) · {fmtDateTime(t.createdAt)}{t.recordRef ? ` · ref: ${t.recordRef}` : ""}</p><p className="mt-1 whitespace-pre-line text-sm">{t.body}</p>
        <div className="mt-1 flex gap-3 text-sm">{["open", "in_progress", "resolved"].filter((s) => s !== t.status).map((s) => <form key={s} action={setTicketStatusAction.bind(null, t.id, s)}><button className="link-btn" type="submit">→ {s}</button></form>)}</div></li>)}{rows.length === 0 && <li className="text-ink-soft">Nenhum chamado.</li>}</ul></section>
  );
}

async function Piloto() {
  const since = new Date(Date.now() - 90 * 864e5);
  const ev = await db.select().from(events).where(and(gte(events.createdAt, since), inArray(events.name, ["signup", "draft_created", "search_done", "swap", "export", "application_created", "grades_published", "class_created"]))).orderBy(events.createdAt);
  const firstDraft = new Map<string, Date>(); const firstExport = new Map<string, Date>();
  const signups = new Map<string, Date>(); const exportsByUser = new Map<string, Date[]>(); const appsByUser = new Map<string, number>();
  const prep: number[] = []; let searchFound = 0; let searchWanted = 0; let swaps = 0; let gradesPub = 0; let apps = 0;
  for (const e of ev) {
    const m = (e.meta ?? {}) as Record<string, unknown>; const aid = String(m.assessmentId ?? "");
    if (e.name === "signup" && e.userId) signups.set(e.userId, e.createdAt);
    if (e.name === "draft_created" && aid) firstDraft.set(aid, e.createdAt);
    if (e.name === "export" && aid && !firstExport.has(aid)) firstExport.set(aid, e.createdAt);
    if (e.name === "export" && e.userId) exportsByUser.set(e.userId, [...(exportsByUser.get(e.userId) ?? []), e.createdAt]);
    if (e.name === "search_done") { searchFound += Number(m.found ?? 0); searchWanted += Number(m.wanted ?? 0); }
    if (e.name === "swap") swaps++;
    if (e.name === "grades_published") gradesPub++;
    if (e.name === "application_created") { apps++; if (e.userId) appsByUser.set(e.userId, (appsByUser.get(e.userId) ?? 0) + 1); }
  }
  for (const [aid, t0] of firstDraft) { const t1 = firstExport.get(aid); if (t1) prep.push((t1.getTime() - t0.getTime()) / 60000); }
  prep.sort((a, b) => a - b);
  const median = prep.length ? prep[Math.floor(prep.length / 2)] : null;
  let activated = 0; for (const [u, t0] of signups) { if ((exportsByUser.get(u) ?? []).some((t) => t.getTime() - t0.getTime() <= 7 * 864e5)) activated++; }
  const returning = [...appsByUser.values()].filter((n) => n >= 2).length;
  const [{ n: nUsers }] = await db.select({ n: count() }).from(users);
  return (
    <section className="card"><h2 className="mb-2 text-lg">Indicadores do piloto (últimos 90 dias)</h2>
      <p className="hint mb-3">Calculados dos eventos coletados. Contas de demonstração e de teste devem ser filtradas na análise. Linha de base e limiares finais são definidos após o piloto.</p>
      <table className="t"><tbody>
        <tr><th>Tempo de preparação (mediana, rascunho → 1º PDF)</th><td>{median != null ? `${median.toFixed(1)} min (${prep.length} provas)` : "sem dados"}</td></tr>
        <tr><th>Ativação (novos professores que exportam em até 7 dias)</th><td>{signups.size ? `${activated} de ${signups.size} (${Math.round((activated / signups.size) * 100)}%)` : "sem dados"}</td></tr>
        <tr><th>Qualidade do filtro (itens achados / pedidos)</th><td>{searchWanted ? `${searchFound} de ${searchWanted} (${Math.round((searchFound / searchWanted) * 100)}%)` : "sem dados"} · {swaps} troca(s) feitas pelos professores</td></tr>
        <tr><th>Uso após a prova (aplicações com notas lançadas)</th><td>{apps ? `${gradesPub} lançamento(s) de notas para ${apps} aplicação(ões)` : "sem dados"}</td></tr>
        <tr><th>Retorno (professores com 2+ aplicações)</th><td>{returning}</td></tr>
        <tr><th>Usuários cadastrados</th><td>{Number(nUsers)}</td></tr></tbody></table></section>
  );
}

async function Saude() {
  const [u] = await db.select({ n: count() }).from(users);
  const [o] = await db.select({ n: count() }).from(orgs);
  const [q] = await db.select({ n: count() }).from(questions);
  const recent = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(40);
  const dbOk = await db.execute(sql`select 1 as ok`);
  return (
    <div className="space-y-6"><section className="card"><h2 className="mb-2 text-lg">Saúde do serviço</h2><ul className="text-sm"><li>Banco de dados: {dbOk.rows.length ? "ok" : "falha"}</li><li>Usuários: {Number(u.n)} · Contas/escolas: {Number(o.n)} · Questões: {Number(q.n)}</li><li>E-mail: {process.env.RESEND_API_KEY ? "configurado" : "não configurado"} · IA: {process.env.AI_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY ? "configurada" : "não configurada"} · Pagamentos: {process.env.BILLING_PROVIDER ?? "não configurado"}</li></ul></section>
      <section className="card overflow-x-auto"><h2 className="mb-2 text-lg">Histórico de operações (auditoria)</h2><p className="hint mb-2">Sem expor nomes, fotos ou conteúdo de anexos.</p><table className="t"><thead><tr><th>Quando</th><th>Ação</th><th>Alvo</th></tr></thead><tbody>{recent.map((a) => <tr key={a.id}><td>{fmtDateTime(a.createdAt)}</td><td>{a.action}</td><td className="text-xs">{a.target ?? ""}</td></tr>)}</tbody></table></section></div>
  );
}
