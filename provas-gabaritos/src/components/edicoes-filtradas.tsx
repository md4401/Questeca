"use client";
import { useMemo, useState } from "react";
import type { Edicao } from "@/lib/tipos";
import { TIPOS_ARQUIVO, TIPO_ROTULO } from "@/lib/tipos";
import { buscar, agruparPorAno, valoresDistintos } from "@/lib/busca";
import { EdicaoCardCliente } from "@/components/edicao-card-cliente";

type E = Edicao & { _s: Record<number, { status: string; em?: string }> };

/** Lista de uma instituição: filtra por texto, tipo, fase, dia e disciplina; agrupa por ano e oferece "ir para o ano". */
export function EdicoesFiltradas({ edicoes }: { edicoes: E[] }) {
  const [q, setQ] = useState(""); const [tipo, setTipo] = useState(""); const [fase, setFase] = useState(""); const [dia, setDia] = useState(""); const [disc, setDisc] = useState(""); const [antigos, setAntigos] = useState(false);
  const fases = useMemo(() => valoresDistintos(edicoes, "fase"), [edicoes]);
  const dias = useMemo(() => valoresDistintos(edicoes, "dia"), [edicoes]);
  const lista = useMemo(() => buscar(edicoes, [], { q, tipo: tipo || undefined, fase: fase || undefined, dia: dia || undefined, disciplina: disc || undefined, ordem: antigos ? "antigos" : "recentes" }) as E[], [edicoes, q, tipo, fase, dia, disc, antigos]);
  const grupos = useMemo(() => { const g = agruparPorAno(lista); return antigos ? g.reverse() : g; }, [lista, antigos]);
  const filtrando = !!(q || tipo || fase || dia || disc);
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filtrar edições">
        <div className="sm:col-span-2"><label htmlFor="f-q" className="mb-1 block text-sm font-semibold">Buscar na lista</label><input id="f-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ano ou palavra (ex.: 2019, redação)" autoComplete="off" enterKeyHint="search" /></div>
        <div><label htmlFor="f-tipo" className="mb-1 block text-sm font-semibold">Documento</label>
          <select id="f-tipo" className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option>{TIPOS_ARQUIVO.map((t) => <option key={t} value={t}>{TIPO_ROTULO[t]}</option>)}</select></div>
        <div><label htmlFor="f-ano" className="mb-1 block text-sm font-semibold">Ir para o ano</label>
          <select id="f-ano" className="input" value="" onChange={(e) => { if (e.target.value) document.getElementById(`ano-${e.target.value}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><option value="">Escolher…</option>{grupos.map(([ano]) => <option key={ano} value={ano}>{ano}</option>)}</select></div>
        {fases.length > 1 && <div><label htmlFor="f-fase" className="mb-1 block text-sm font-semibold">Fase / etapa</label>
          <select id="f-fase" className="input" value={fase} onChange={(e) => setFase(e.target.value)}><option value="">Todas</option>{fases.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>}
        {dias.length > 0 && <div><label htmlFor="f-dia" className="mb-1 block text-sm font-semibold">Dia</label>
          <select id="f-dia" className="input" value={dia} onChange={(e) => setDia(e.target.value)}><option value="">Todos</option>{dias.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>}
        <div><label htmlFor="f-disc" className="mb-1 block text-sm font-semibold">Disciplina / área</label><input id="f-disc" className="input" value={disc} onChange={(e) => setDisc(e.target.value)} placeholder="Ex.: Matemática" autoComplete="off" /></div>
        <div className="flex items-end"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={antigos} onChange={(e) => setAntigos(e.target.checked)} /> Mais antigas primeiro</label></div>
      </div>
      <p className="hint mt-3" role="status" aria-live="polite">{lista.length} {lista.length === 1 ? "edição" : "edições"}{filtrando ? " encontrada(s)" : ""}</p>
      {grupos.length === 0 ? <p className="card mt-4 text-ink-soft">Nenhuma edição com esses filtros.</p> : (
        <div className="mt-4 space-y-8">{grupos.map(([ano, es]) => (
          <section key={ano} id={`ano-${ano}`} aria-labelledby={`h-${ano}`} className="scroll-mt-20">
            <h2 id={`h-${ano}`} className="mb-3 text-2xl">{ano}</h2>
            <div className="grid gap-3 lg:grid-cols-2">{es.map((e) => <EdicaoCardCliente key={e.id} e={e as E} />)}</div>
          </section>))}</div>)}
    </div>
  );
}
