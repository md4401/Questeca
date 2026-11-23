"use client";
import { useMemo, useState } from "react";
import type { Edicao } from "@/lib/tipos";
import { TIPOS_ARQUIVO, TIPO_ROTULO } from "@/lib/tipos";
import { buscar, agruparPorAno } from "@/lib/busca";
import { EdicaoCardCliente } from "@/components/edicao-card-cliente";

type E = Edicao & { _s: Record<number, { status: string; em?: string }> };

/** Lista de uma instituição: filtra por texto e tipo, agrupa por ano e oferece "ir para o ano". */
export function EdicoesFiltradas({ edicoes }: { edicoes: E[] }) {
  const [q, setQ] = useState(""); const [tipo, setTipo] = useState("");
  const lista = useMemo(() => buscar(edicoes, [], { q, tipo: tipo || undefined }) as E[], [edicoes, q, tipo]);
  const grupos = useMemo(() => agruparPorAno(lista), [lista]);
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem_12rem]" role="search" aria-label="Filtrar edições">
        <div><label htmlFor="f-q" className="mb-1 block text-sm font-semibold">Buscar na lista</label><input id="f-q" className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ano ou nome (ex.: 2019, 2ª fase)" autoComplete="off" enterKeyHint="search" /></div>
        <div><label htmlFor="f-tipo" className="mb-1 block text-sm font-semibold">Arquivo</label>
          <select id="f-tipo" className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option>{TIPOS_ARQUIVO.map((t) => <option key={t} value={t}>{TIPO_ROTULO[t]}</option>)}</select></div>
        <div><label htmlFor="f-ano" className="mb-1 block text-sm font-semibold">Ir para o ano</label>
          <select id="f-ano" className="input" value="" onChange={(e) => { if (e.target.value) document.getElementById(`ano-${e.target.value}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><option value="">Escolher…</option>{grupos.map(([ano]) => <option key={ano} value={ano}>{ano}</option>)}</select></div>
      </div>
      <p className="hint mt-3" role="status" aria-live="polite">{lista.length} {lista.length === 1 ? "edição" : "edições"}{q || tipo ? " encontrada(s)" : ""}</p>
      {grupos.length === 0 ? <p className="card mt-4 text-ink-soft">Nenhuma edição com esses filtros.</p> : (
        <div className="mt-4 space-y-8">{grupos.map(([ano, es]) => (
          <section key={ano} id={`ano-${ano}`} aria-labelledby={`h-${ano}`} className="scroll-mt-20">
            <h2 id={`h-${ano}`} className="mb-3 text-2xl">{ano}</h2>
            <div className="grid gap-3 lg:grid-cols-2">{es.map((e) => <EdicaoCardCliente key={e.id} e={e as E} />)}</div>
          </section>))}</div>)}
    </div>
  );
}
