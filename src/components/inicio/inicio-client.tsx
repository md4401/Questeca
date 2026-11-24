"use client";
import { useState } from "react";

/** Seletor de período: formulário GET comum (recarrega a página), sem depender de navegação do cliente. */
export function PeriodoSelect({ periodos, atual }: { periodos: string[]; atual: string }) {
  return (
    <form method="get" action="/app" className="inline-flex items-center gap-1">
      <label htmlFor="periodo" className="sr-only">Período do desempenho</label>
      <select id="periodo" name="periodo" defaultValue={atual} className="input !min-h-[36px] !w-auto !py-1 text-sm" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {periodos.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <noscript><button className="btn btn-sm" type="submit">Ver</button></noscript>
    </form>
  );
}

/** Celular e tablet: alterna entre atividades e provas recentes (no computador as duas listas ficam lado a lado). */
export function RecentesTabs({ atividades, provas }: { atividades: React.ReactNode; provas: React.ReactNode }) {
  const [aba, setAba] = useState<"atividades" | "provas">("atividades");
  const Aba = ({ id, children }: { id: "atividades" | "provas"; children: React.ReactNode }) => (
    <button type="button" role="tab" id={`tab-${id}`} aria-selected={aba === id} aria-controls={`painel-${id}`} className="recentes-tab" onClick={() => setAba(id)}>{children}</button>);
  return (
    <section className="card xl:hidden" aria-label="Recentes">
      <div role="tablist" aria-label="Recentes" className="recentes-tabs"><Aba id="atividades">Atividades recentes</Aba><Aba id="provas">Provas recentes</Aba></div>
      <div role="tabpanel" id="painel-atividades" aria-labelledby="tab-atividades" hidden={aba !== "atividades"}>{atividades}</div>
      <div role="tabpanel" id="painel-provas" aria-labelledby="tab-provas" hidden={aba !== "provas"}>{provas}</div>
    </section>
  );
}
