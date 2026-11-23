/**
 * Importa um CSV de links oficiais para data/edicoes/<instituicao>.json.
 *   pnpm importar caminho/arquivo.csv
 * Colunas: instituicao, ano, nome, tipo, rotulo, url, formato, fonte, observacao
 * (tipo: prova | gabarito | caderno | comentada | edital | outro). Depois rode `pnpm validar`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { lerCsv, agruparCsv, mesclar } from "../src/lib/importar";
import type { Edicao } from "../src/lib/tipos";

const arq = process.argv[2];
if (!arq) { console.error("uso: pnpm importar arquivo.csv"); process.exit(1); }
const { edicoes, erros } = agruparCsv(lerCsv(readFileSync(arq, "utf8")));
for (const e of erros) console.error("ERRO ", e);
if (erros.length) process.exit(1);
const porInst = new Map<string, Edicao[]>();
for (const e of edicoes) (porInst.get(e.instituicao) ?? porInst.set(e.instituicao, []).get(e.instituicao)!).push(e);
for (const [inst, novas] of porInst) {
  const f = `data/edicoes/${inst}.json`;
  if (!existsSync(f)) { console.error(`ERRO instituição desconhecida: ${inst} (cadastre em data/instituicoes.json)`); process.exit(1); }
  const atuais = JSON.parse(readFileSync(f, "utf8")) as Edicao[];
  const juntas = mesclar(atuais, novas);
  writeFileSync(f, JSON.stringify(juntas, null, 2) + "\n");
  console.log(`${inst}: ${atuais.length} → ${juntas.length} edições`);
}
