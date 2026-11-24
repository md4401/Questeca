"use client";
import { useState } from "react";
import { embaralhar, grupos, gruposPorTamanho } from "@/lib/core/sorteio";

/** Sorteio de aluno, formação de grupos e ordem de apresentação — tudo no navegador, sem gravar nada. */
export function Sorteio({ alunos }: { alunos: { id: string; name: string }[] }) {
  const [fora, setFora] = useState<Set<string>>(new Set());
  const [sorteado, setSorteado] = useState<string | null>(null); const [girando, setGirando] = useState(false);
  const [modo, setModo] = useState<"qtd" | "tam">("tam"); const [n, setN] = useState(4);
  const [gr, setGr] = useState<string[][] | null>(null); const [ordem, setOrdem] = useState<string[] | null>(null);
  const ativos = alunos.filter((a) => !fora.has(a.id)).map((a) => a.name);
  const alterna = (id: string) => setFora((f) => { const x = new Set(f); if (x.has(id)) x.delete(id); else x.add(id); return x; });

  function sortear() {
    if (!ativos.length || girando) return;
    setGirando(true); let i = 0;
    const t = setInterval(() => { setSorteado(ativos[Math.floor(Math.random() * ativos.length)]); if (++i > 14) { clearInterval(t); setSorteado(embaralhar(ativos)[0]); setGirando(false); } }, 80);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <section className="card h-fit"><h2 className="mb-1 text-lg">Quem participa</h2><p className="hint mb-2">Desmarque quem faltou hoje.</p>
        <ul className="max-h-96 space-y-1 overflow-y-auto">{alunos.map((a) => <li key={a.id}><label className="flex items-center gap-2 font-normal"><input type="checkbox" checked={!fora.has(a.id)} onChange={() => alterna(a.id)} />{a.name}</label></li>)}</ul>
        <p className="hint mt-2">{ativos.length} de {alunos.length}</p></section>
      <div className="space-y-4">
        <section className="card text-center"><h2 className="mb-2 text-lg">Sortear um aluno</h2>
          <p className="my-4 min-h-[3rem] text-3xl font-bold text-brand" data-testid="sorteado" aria-live="polite">{sorteado ?? "—"}</p>
          <button className="btn" type="button" onClick={sortear} disabled={!ativos.length || girando} data-testid="sortear">{girando ? "Sorteando…" : "Sortear"}</button></section>
        <section className="card"><h2 className="mb-2 text-lg">Formar grupos</h2>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div className="field mb-0"><label htmlFor="modo">Dividir por</label><select id="modo" className="input" value={modo} onChange={(e) => setModo(e.target.value as "qtd" | "tam")}><option value="tam">Alunos por grupo</option><option value="qtd">Número de grupos</option></select></div>
            <div className="field mb-0"><label htmlFor="n">{modo === "tam" ? "Tamanho" : "Grupos"}</label><input id="n" className="input w-24" type="number" min={1} max={40} value={n} onChange={(e) => setN(Math.max(1, Number(e.target.value) || 1))} /></div>
            <button className="btn" type="button" onClick={() => setGr((modo === "tam" ? gruposPorTamanho(ativos, n) : grupos(ativos, n)))} disabled={!ativos.length} data-testid="formar-grupos">Formar grupos</button></div>
          {gr && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="grupos">{gr.map((g, i) => <div key={i} className="rounded-xl border border-line p-3"><p className="mb-1 font-bold text-brand">Grupo {i + 1}</p><ul className="text-sm">{g.map((x) => <li key={x}>{x}</li>)}</ul></div>)}</div>}
        </section>
        <section className="card"><h2 className="mb-2 text-lg">Ordem de apresentação</h2>
          <button className="btn btn-ghost" type="button" onClick={() => setOrdem(embaralhar(ativos))} disabled={!ativos.length} data-testid="sortear-ordem">Sortear ordem</button>
          {ordem && <ol className="mt-3 list-decimal space-y-0.5 pl-6 text-sm sm:columns-2">{ordem.map((x) => <li key={x}>{x}</li>)}</ol>}</section>
      </div>
    </div>
  );
}
