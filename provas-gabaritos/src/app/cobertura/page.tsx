import type { Metadata } from "next";
import Link from "next/link";
import { instituicoes, edicoes, verificacao } from "@/lib/catalogo";
import { coberturaGeral, faixas, buracos, SITUACAO_ROTULO } from "@/lib/cobertura";

export const metadata: Metadata = {
  title: "Cobertura do catálogo",
  description: "O que já está disponível em cada uma das 20 instituições: edições, anos com arquivos, provas, gabaritos e lacunas conhecidas.",
  alternates: { canonical: "/cobertura" },
};

const cor = { "sem-documentos": "badge-warn", parcial: "badge-warn", ampla: "badge-ok" } as const;

export default function Cobertura() {
  const linhas = coberturaGeral(instituicoes, edicoes, verificacao);
  const soma = (f: (c: (typeof linhas)[number]) => number) => linhas.reduce((n, c) => n + f(c), 0);
  const comDocs = linhas.filter((c) => c.arquivos > 0).length;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-extrabold">Cobertura do catálogo</h1>
        <p className="mt-2 max-w-3xl text-ink-soft">Mostramos apenas o que existe: os anos listados abaixo são aqueles em que há ao menos um arquivo. Um intervalo (por exemplo, “1990–2010”) não significa que todos os anos dentro dele estejam disponíveis — veja os anos sem arquivos em cada instituição. Nenhuma instituição é apresentada como completa.</p>
        <p className="mt-3 text-sm"><strong>{comDocs}</strong> de {linhas.length} instituições com documentos · <strong>{soma((c) => c.edicoes)}</strong> edições · <strong>{soma((c) => c.provas)}</strong> provas · <strong>{soma((c) => c.gabaritos)}</strong> gabaritos{soma((c) => c.outros) ? <> · <strong>{soma((c) => c.outros)}</strong> outros documentos</> : null}</p>
      </header>
      <ul className="grid gap-3 lg:grid-cols-2" aria-label="Instituições">
        {linhas.map((c) => {
          const i = instituicoes.find((x) => x.slug === c.slug)!;
          const bur = buracos(c.anos);
          return (
            <li key={c.slug} className="card" id={c.slug}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-xl"><Link href={`/instituicao/${c.slug}`}>{c.sigla}</Link> <span className="block text-sm font-normal text-ink-soft">{c.nome}</span></h2>
                <span className={`badge ${cor[c.situacao]}`}>{SITUACAO_ROTULO[c.situacao]}</span>
              </div>
              {c.arquivos === 0 ? (
                <p className="mt-3 text-sm text-ink-soft">Nenhum documento coletado ainda.{i.observacao ? ` ${i.observacao}` : ""}</p>
              ) : (
                <>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                    <div><dt className="text-ink-soft">Edições</dt><dd className="font-semibold">{c.edicoes}</dd></div>
                    <div><dt className="text-ink-soft">Primeiro–último ano</dt><dd className="font-semibold">{c.primeiro}–{c.ultimo}</dd></div>
                    <div><dt className="text-ink-soft">Provas</dt><dd className="font-semibold">{c.provas}</dd></div>
                    <div><dt className="text-ink-soft">Gabaritos</dt><dd className="font-semibold">{c.gabaritos}</dd></div>
                  </dl>
                  <p className="mt-3 text-sm"><strong>Anos com arquivos:</strong> {faixas(c.anos)}</p>
                  {bur.length > 0 && <p className="hint mt-1">Sem arquivos neste intervalo: {faixas(bur)}.</p>}
                  {c.anosSemGabarito.length > 0 && <p className="hint mt-1">Provas sem gabarito publicado: {faixas(c.anosSemGabarito)}.</p>}
                  {c.anosSemProva.length > 0 && <p className="hint mt-1">Gabaritos sem prova: {faixas(c.anosSemProva)}.</p>}
                  <p className="hint mt-1">Links: {c.verificados} conferidos{c.quebrados ? ` · ${c.quebrados} fora do ar` : ""}{c.desconhecidos ? ` · ${c.desconhecidos} sem confirmação` : ""}{c.naoVerificados ? ` · ${c.naoVerificados} ainda não conferidos` : ""}.</p>
                  {i.observacao && <p className="hint mt-1">{i.observacao}</p>}
                </>
              )}
            </li>);
        })}
      </ul>
    </div>
  );
}
