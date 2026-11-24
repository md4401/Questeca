/**
 * Relatório de cobertura do catálogo (instituições sem catálogo completo, anos sem prova/gabarito, links, duplicados).
 *   pnpm relatorio            # imprime
 *   pnpm relatorio --salvar   # grava data/relatorio-coleta.md
 */
import { writeFileSync } from "node:fs";
import { EDICOES_BRUTAS, INSTITUICOES_BRUTAS, VERIFICACAO_BRUTA } from "../src/lib/dados";
import { validarCatalogo } from "../src/lib/validacao";
import { coberturaGeral, faixas, buracos, SITUACAO_ROTULO } from "../src/lib/cobertura";

const r = validarCatalogo({ instituicoes: INSTITUICOES_BRUTAS, edicoes: EDICOES_BRUTAS, verificacao: VERIFICACAO_BRUTA });
if (r.erros.length) { console.error(r.erros.join("\n")); process.exit(1); }
const cob = coberturaGeral(r.instituicoes, r.edicoes, r.verificacao);
const soma = (f: (c: (typeof cob)[number]) => number) => cob.reduce((n, c) => n + f(c), 0);
const urls = r.edicoes.flatMap((e) => e.arquivos.map((a) => a.url));
const repetidas = urls.length - new Set(urls).size;
const L: string[] = [];
L.push("# Relatório de cobertura do catálogo", "", `Gerado por \`pnpm relatorio --salvar\`. Instituições: ${cob.length} · edições: ${soma((c) => c.edicoes)} · arquivos: ${soma((c) => c.arquivos)} (provas ${soma((c) => c.provas)}, gabaritos ${soma((c) => c.gabaritos)}, outros ${soma((c) => c.outros)}) · URLs repetidas: ${repetidas}.`, "");
L.push("| Instituição | Situação | Edições | Provas | Gabaritos | Outros | Anos com arquivos | Links ok | Fora do ar | Sem confirmação | Não conferidos |", "|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|");
for (const c of cob) L.push(`| ${c.sigla} | ${SITUACAO_ROTULO[c.situacao]} | ${c.edicoes} | ${c.provas} | ${c.gabaritos} | ${c.outros} | ${c.anos.length ? faixas(c.anos) : "—"} | ${c.verificados} | ${c.quebrados} | ${c.desconhecidos} | ${c.naoVerificados} |`);
L.push("", "## Lacunas por instituição", "");
for (const c of cob) {
  L.push(`### ${c.sigla}`);
  if (!c.arquivos) { L.push("- Nenhum documento coletado.", ""); continue; }
  const b = buracos(c.anos);
  L.push(`- Primeiro/último ano com arquivos: ${c.primeiro}–${c.ultimo}.`);
  if (b.length) L.push(`- Anos sem arquivos dentro do intervalo (não implica que a edição exista): ${faixas(b)}.`);
  if (c.anosSemGabarito.length) L.push(`- Anos com prova e sem gabarito: ${faixas(c.anosSemGabarito)}.`);
  if (c.anosSemProva.length) L.push(`- Anos com gabarito e sem prova: ${faixas(c.anosSemProva)}.`);
  L.push("");
}
const saida = L.join("\n") + "\n";
if (process.argv.includes("--salvar")) { writeFileSync("data/relatorio-coleta.md", saida); console.log("data/relatorio-coleta.md gravado"); } else console.log(saida);
