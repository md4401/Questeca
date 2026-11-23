import type { Metadata } from "next";
import Link from "next/link";
import { edicoes, instituicoes, comStatus } from "@/lib/catalogo";
import { buscar, buscarInstituicoes, agruparPorAno, valoresDistintos } from "@/lib/busca";
import { TIPOS_ARQUIVO, TIPO_ROTULO } from "@/lib/tipos";
import { EdicaoCardCliente } from "@/components/edicao-card-cliente";

export const metadata: Metadata = { title: "Buscar provas e gabaritos", description: "Procure provas e gabaritos por instituição (ou sigla), ano, fase, dia, disciplina e tipo de documento.", alternates: { canonical: "/buscar" } };
const LIMITE = 120;
const num = (v?: string) => (v && /^\d{4}$/.test(v) ? Number(v) : undefined);
const FASES = valoresDistintos(edicoes, "fase").slice(0, 14);
const DIAS = valoresDistintos(edicoes, "dia").slice(0, 10);

type SP = { q?: string; inst?: string; de?: string; ate?: string; tipo?: string; fase?: string; dia?: string; disc?: string; ordem?: string };

export default async function Buscar({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filtro = {
    q: (sp.q ?? "").slice(0, 80), instituicao: instituicoes.some((i) => i.slug === sp.inst) ? sp.inst : undefined, de: num(sp.de), ate: num(sp.ate),
    tipo: (TIPOS_ARQUIVO as readonly string[]).includes(sp.tipo ?? "") ? sp.tipo : undefined,
    fase: (sp.fase ?? "").slice(0, 40) || undefined, dia: (sp.dia ?? "").slice(0, 20) || undefined, disciplina: (sp.disc ?? "").slice(0, 40) || undefined,
    ordem: sp.ordem === "antigos" ? ("antigos" as const) : ("recentes" as const),
  };
  const filtrando = !!(filtro.q || filtro.instituicao || filtro.de || filtro.ate || filtro.tipo || filtro.fase || filtro.dia || filtro.disciplina);
  const todas = filtrando ? buscar(edicoes, instituicoes, filtro) : [];
  const mostradas = todas.slice(0, LIMITE);
  const insts = filtro.q ? buscarInstituicoes(instituicoes, filtro.q) : [];
  const nomeDe = (slug: string) => instituicoes.find((i) => i.slug === slug)?.sigla ?? slug;
  const grupos = agruparPorAno(mostradas);
  if (filtro.ordem === "antigos") grupos.reverse();
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold">Buscar</h1>
      <form className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <div className="sm:col-span-2"><label htmlFor="q" className="mb-1 block text-sm font-semibold">Palavras</label><input id="q" name="q" type="search" className="input" defaultValue={filtro.q} placeholder="Ex.: Unicamp 2023, PAS UnB, ITA gabarito" autoComplete="off" enterKeyHint="search" /></div>
        <div><label htmlFor="inst" className="mb-1 block text-sm font-semibold">Instituição</label><select id="inst" name="inst" className="input" defaultValue={filtro.instituicao ?? ""}><option value="">Todas</option>{instituicoes.map((i) => <option key={i.slug} value={i.slug}>{i.sigla}</option>)}</select></div>
        <div><label htmlFor="tipo" className="mb-1 block text-sm font-semibold">Documento</label><select id="tipo" name="tipo" className="input" defaultValue={filtro.tipo ?? ""}><option value="">Todos</option>{TIPOS_ARQUIVO.map((t) => <option key={t} value={t}>{TIPO_ROTULO[t]}</option>)}</select></div>
        <div><label htmlFor="de" className="mb-1 block text-sm font-semibold">De (ano)</label><input id="de" name="de" inputMode="numeric" maxLength={4} className="input" defaultValue={filtro.de ?? ""} placeholder="1998" /></div>
        <div><label htmlFor="ate" className="mb-1 block text-sm font-semibold">Até (ano)</label><input id="ate" name="ate" inputMode="numeric" maxLength={4} className="input" defaultValue={filtro.ate ?? ""} placeholder="2027" /></div>
        <div><label htmlFor="fase" className="mb-1 block text-sm font-semibold">Fase / etapa</label><input id="fase" name="fase" list="lista-fases" className="input" defaultValue={filtro.fase ?? ""} placeholder="Ex.: 2ª fase" autoComplete="off" /><datalist id="lista-fases">{FASES.map((f) => <option key={f} value={f} />)}</datalist></div>
        <div><label htmlFor="dia" className="mb-1 block text-sm font-semibold">Dia</label><input id="dia" name="dia" list="lista-dias" className="input" defaultValue={filtro.dia ?? ""} placeholder="Ex.: 1º dia" autoComplete="off" /><datalist id="lista-dias">{DIAS.map((f) => <option key={f} value={f} />)}</datalist></div>
        <div><label htmlFor="disc" className="mb-1 block text-sm font-semibold">Disciplina / área</label><input id="disc" name="disc" className="input" defaultValue={filtro.disciplina ?? ""} placeholder="Ex.: Matemática" autoComplete="off" /></div>
        <div><label htmlFor="ordem" className="mb-1 block text-sm font-semibold">Ordem</label><select id="ordem" name="ordem" className="input" defaultValue={filtro.ordem}><option value="recentes">Mais recentes primeiro</option><option value="antigos">Mais antigas primeiro</option></select></div>
        <div className="flex items-end"><button className="btn w-full" type="submit">Buscar</button></div>
      </form>
      {insts.length > 0 && (
        <section aria-label="Instituições encontradas"><h2 className="mb-2 text-lg">Instituições</h2>
          <ul className="flex flex-wrap gap-2">{insts.map((i) => <li key={i.slug}><Link className="badge no-underline" href={`/instituicao/${i.slug}`}>{i.sigla} — {i.nome}</Link></li>)}</ul></section>)}
      {!filtrando ? <p className="card text-ink-soft">Digite palavras (nome, sigla, ano, fase…) ou combine os filtros. Veja também a <Link href="/cobertura">cobertura de cada instituição</Link>.</p> : (
        <section aria-live="polite">
          <p className="hint">{todas.length} {todas.length === 1 ? "edição encontrada" : "edições encontradas"}{todas.length > LIMITE ? ` (mostrando as ${LIMITE} primeiras; refine a busca)` : ""}</p>
          {todas.length === 0 ? <p className="card mt-3 text-ink-soft">Nenhuma edição encontrada. Tente menos palavras ou outro período{insts.length ? "; a instituição acima pode ainda não ter documentos coletados (veja a cobertura)" : ""}.</p> : (
            <div className="mt-4 space-y-8">{grupos.map(([ano, es]) => (
              <section key={ano} aria-labelledby={`h-${ano}`}><h2 id={`h-${ano}`} className="mb-3 text-2xl">{ano}</h2>
                <div className="grid gap-3 lg:grid-cols-2">{es.map((e) => <div key={e.id}><p className="badge mb-1">{nomeDe(e.instituicao)}</p><EdicaoCardCliente e={comStatus(e)} /></div>)}</div></section>))}</div>)}
        </section>)}
    </div>
  );
}
