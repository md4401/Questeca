import type { Metadata } from "next";
import Link from "next/link";
import { edicoes, instituicoes, comStatus } from "@/lib/catalogo";
import { buscar, agruparPorAno } from "@/lib/busca";
import { TIPOS_ARQUIVO, TIPO_ROTULO } from "@/lib/tipos";
import { EdicaoCardCliente } from "@/components/edicao-card-cliente";

export const metadata: Metadata = { title: "Buscar provas e gabaritos" };
const LIMITE = 120;
const num = (v?: string) => (v && /^\d{4}$/.test(v) ? Number(v) : undefined);

export default async function Buscar({ searchParams }: { searchParams: Promise<{ q?: string; inst?: string; de?: string; ate?: string; tipo?: string }> }) {
  const sp = await searchParams;
  const filtro = { q: (sp.q ?? "").slice(0, 80), instituicao: instituicoes.some((i) => i.slug === sp.inst) ? sp.inst : undefined, de: num(sp.de), ate: num(sp.ate), tipo: (TIPOS_ARQUIVO as readonly string[]).includes(sp.tipo ?? "") ? sp.tipo : undefined };
  const filtrando = !!(filtro.q || filtro.instituicao || filtro.de || filtro.ate || filtro.tipo);
  const todas = filtrando ? buscar(edicoes, instituicoes, filtro) : [];
  const mostradas = todas.slice(0, LIMITE);
  const nomeDe = (slug: string) => instituicoes.find((i) => i.slug === slug)?.sigla ?? slug;
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold">Buscar</h1>
      <form className="card grid gap-3 md:grid-cols-[1fr_12rem_7rem_7rem_11rem_auto] md:items-end" role="search">
        <div><label htmlFor="q" className="mb-1 block text-sm font-semibold">Palavras</label><input id="q" name="q" type="search" className="input" defaultValue={filtro.q} placeholder="Ex.: ENEM 2019" autoComplete="off" enterKeyHint="search" /></div>
        <div><label htmlFor="inst" className="mb-1 block text-sm font-semibold">Instituição</label><select id="inst" name="inst" className="input" defaultValue={filtro.instituicao ?? ""}><option value="">Todas</option>{instituicoes.map((i) => <option key={i.slug} value={i.slug}>{i.sigla}</option>)}</select></div>
        <div><label htmlFor="de" className="mb-1 block text-sm font-semibold">De (ano)</label><input id="de" name="de" inputMode="numeric" maxLength={4} className="input" defaultValue={filtro.de ?? ""} placeholder="1998" /></div>
        <div><label htmlFor="ate" className="mb-1 block text-sm font-semibold">Até (ano)</label><input id="ate" name="ate" inputMode="numeric" maxLength={4} className="input" defaultValue={filtro.ate ?? ""} placeholder="2025" /></div>
        <div><label htmlFor="tipo" className="mb-1 block text-sm font-semibold">Arquivo</label><select id="tipo" name="tipo" className="input" defaultValue={filtro.tipo ?? ""}><option value="">Todos</option>{TIPOS_ARQUIVO.map((t) => <option key={t} value={t}>{TIPO_ROTULO[t]}</option>)}</select></div>
        <button className="btn" type="submit">Buscar</button>
      </form>
      {!filtrando ? <p className="card text-ink-soft">Digite palavras, escolha uma instituição ou um período. Para ver tudo de uma banca, abra a página dela na <Link href="/">lista de instituições</Link>.</p> : (
        <section aria-live="polite">
          <p className="hint">{todas.length} {todas.length === 1 ? "edição encontrada" : "edições encontradas"}{todas.length > LIMITE ? ` (mostrando as ${LIMITE} mais recentes; refine a busca)` : ""}</p>
          {todas.length === 0 ? <p className="card mt-3 text-ink-soft">Nenhuma edição encontrada. Tente menos palavras ou outro período.</p> : (
            <div className="mt-4 space-y-8">{agruparPorAno(mostradas).map(([ano, es]) => (
              <section key={ano} aria-labelledby={`h-${ano}`}><h2 id={`h-${ano}`} className="mb-3 text-2xl">{ano}</h2>
                <div className="grid gap-3 lg:grid-cols-2">{es.map((e) => <div key={e.id}><p className="badge mb-1">{nomeDe(e.instituicao)}</p><EdicaoCardCliente e={comStatus(e)} /></div>)}</div></section>))}</div>)}
        </section>)}
    </div>
  );
}
