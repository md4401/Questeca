import Link from "next/link";
import data from "@/data/provas-oficiais.json";
import { searchCatalog, TIPOS, type Catalogo } from "@/lib/core/provas-oficiais";

const cat = data as unknown as Catalogo;
const PER = 20;

/** Catálogo de provas e gabaritos oficiais (Enem, Fuvest, Unicamp…). Só aponta para os arquivos nos sites das instituições. */
export function ProvasOficiais({ sp }: { sp: { q?: string; inst?: string; ano?: string; tipo?: string; pag?: string } }) {
  const ano = /^\d{4}$/.test(sp.ano ?? "") ? Number(sp.ano) : undefined;
  const res = searchCatalog(cat, { q: sp.q, inst: sp.inst || undefined, ano, tipo: sp.tipo || undefined });
  const page = Math.max(1, Number(sp.pag) || 1);
  const slice = res.slice((page - 1) * PER, page * PER);
  const pages = Math.max(1, Math.ceil(res.length / PER));
  const counts = new Map<string, number>(); for (const e of cat.edicoes) counts.set(e.s, (counts.get(e.s) ?? 0) + 1);
  const withData = cat.instituicoes.filter((i) => counts.has(i.slug));
  const anos = [...new Set(cat.edicoes.map((e) => e.a))].sort((a, b) => b - a);
  const qs = (extra: Record<string, string>) => { const p = new URLSearchParams({ aba: "provas", ...(sp.q ? { q: sp.q } : {}), ...(sp.inst ? { inst: sp.inst } : {}), ...(sp.ano ? { ano: sp.ano } : {}), ...(sp.tipo ? { tipo: sp.tipo } : {}), ...extra }); return `/app/banco?${p}`; };
  const totalFiles = cat.edicoes.reduce((a, e) => a + e.ar.length, 0);
  return (
    <div className="space-y-5">
      <div><h1>Provas e gabaritos oficiais</h1><p className="hint">{cat.edicoes.length} edições e {totalFiles} arquivos de {withData.length} instituições. Os botões levam ao arquivo no site da própria instituição; a Questeca não copia nem hospeda as provas.</p></div>
      <form role="search" className="card space-y-3">
        <div className="flex flex-wrap gap-2"><div className="field !mb-0 min-w-[16rem] flex-1"><label htmlFor="q" className="sr-only">Buscar provas e gabaritos</label><input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Ex.: Enem 2023, Fuvest 2020, Unicamp, USP, redação…" /></div><input type="hidden" name="aba" value="provas" /><button className="btn" type="submit">Buscar</button></div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="field !mb-0"><label htmlFor="inst">Instituição</label><select id="inst" name="inst" defaultValue={sp.inst ?? ""} className="input"><option value="">Todas</option>{withData.map((i) => <option key={i.slug} value={i.slug}>{i.sigla} ({counts.get(i.slug)})</option>)}</select></div>
          <div className="field !mb-0"><label htmlFor="ano">Ano</label><select id="ano" name="ano" defaultValue={sp.ano ?? ""} className="input"><option value="">Todos</option>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
          <div className="field !mb-0"><label htmlFor="tipo">Documento</label><select id="tipo" name="tipo" defaultValue={sp.tipo ?? ""} className="input"><option value="">Todos</option>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        {(sp.q || sp.inst || sp.ano || sp.tipo) && <p className="text-sm"><a href="/app/banco?aba=provas">Limpar busca e filtros</a></p>}
      </form>
      <p className="hint" aria-live="polite">{res.length} edição(ões) encontrada(s){res.length > PER ? ` · página ${page} de ${pages}` : ""}.</p>
      <ul className="space-y-3">
        {slice.map(({ ed, inst, arquivos }) => (
          <li key={ed.id} className="card" data-testid="edicao-oficial">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold text-ink-soft">{inst.sigla} · {ed.a}{ed.f ? ` · ${ed.f}` : ""}{ed.d ? ` · ${ed.d}` : ""}</p><h2 className="text-base">{ed.n}</h2></div>
              {ed.fo && <a className="text-sm" href={ed.fo} target="_blank" rel="noopener noreferrer">Página oficial<span className="sr-only"> (abre em nova aba)</span></a>}</div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {arquivos.map((a) => (
                <li key={a.u} className="flex items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
                  <span className="min-w-0"><span className={`badge ${a.t === "gabarito" ? "badge-ok" : a.t === "prova" ? "" : "badge-gray"} mr-1.5`}>{TIPOS[a.t] ?? a.t}</span><span className="break-words">{a.r}</span></span>
                  {a.x ? <span className="hint whitespace-nowrap" title="O link oficial não respondeu na última conferência">link fora do ar</span> : <a className="btn btn-sm" href={a.u} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${a.fm.toUpperCase()}: ${a.r} (${inst.sigla} ${ed.a})`}>Abrir {a.fm.toUpperCase()}</a>}
                </li>))}
            </ul>
          </li>))}
        {slice.length === 0 && <li className="card empty">Nenhuma edição encontrada. Tente “Enem 2023”, “Fuvest”, “Unicamp” ou limpe os filtros. Instituições como Univesp, Fatec, UFRGS, IME, EsPCEx, AFA, Insper, FGV e Einstein ainda não têm arquivos no catálogo (acesso bloqueado ou nada publicado).</li>}
      </ul>
      {pages > 1 && <nav className="flex items-center justify-between" aria-label="Páginas">{page > 1 ? <a className="btn btn-ghost" href={qs({ pag: String(page - 1) })}>← Anterior</a> : <span />}<span className="hint">Página {page} de {pages}</span>{page < pages ? <a className="btn btn-ghost" href={qs({ pag: String(page + 1) })}>Próxima →</a> : <span />}</nav>}
    </div>
  );
}
