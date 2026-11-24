/**
 * Importa as questões extraídas (JSONL de scripts/extracao) para o banco, como "curation".
 * Uso: pnpm db:importar-questoes <arquivo-ou-pasta.jsonl> [mais...]
 * Idempotente: pula questões já existentes (instituição|prova|ano|fase|número).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { questions } from "../src/db/schema";
import { searchNormOf } from "../src/lib/core/search";
import { classificar } from "../src/lib/core/classificacao";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
else if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${new URL(url).host}/sql`;
const db = drizzle(neon(url));

const files: string[] = [];
for (const a of process.argv.slice(2)) {
  if (statSync(a).isDirectory()) readdirSync(a).filter((f) => f.endsWith(".jsonl")).forEach((f) => files.push(join(a, f)));
  else files.push(a);
}
if (!files.length) throw new Error("Informe arquivos .jsonl ou uma pasta.");

const NOMES: Record<string, string> = { fuvest: "Fuvest", uerj: "Uerj", comvest: "Comvest", "puc-sp": "PUC-SP", espm: "ESPM", mackenzie: "Mackenzie", vunesp: "Vunesp", ufpr: "UFPR", pas: "PAS/UnB", ita: "ITA", "puc-campinas": "PUC-Campinas", upe: "UPE", ufpel: "UFPel (PAVE)", unicentro: "Unicentro", etec: "Etec", ifrs: "IFRS", obm: "OBM", obmep: "OBMEP", ufg: "UFG", unifesp: "Unifesp", ufscar: "UFSCar" };
const nomeBanca = (i: string) => NOMES[i.toLowerCase()] ?? i;
const key = (i: string, e: string, y: number, ph: string | null, n: number) => `${i}|${e}|${y}|${ph ?? ""}|${n}`;
const existing = new Set<string>();
const rows = await db.select({ i: questions.institution, e: questions.exam, y: questions.year, p: questions.phase, n: questions.number }).from(questions);
for (const r of rows) if (r.n != null) existing.add(key(r.i, r.e, r.y, r.p, r.n));

const batch: (typeof questions.$inferInsert)[] = [];
let lidas = 0, puladas = 0;
for (const f of files) {
  for (const line of readFileSync(f, "utf8").split("\n")) {
    if (!line.trim()) continue;
    lidas++;
    const r = JSON.parse(line);
    if (!r.enunciado || !r.instituicao || !r.ano || !r.numero) { puladas++; continue; }
    const k = key(nomeBanca(r.instituicao), r.exam, r.ano, r.fase ?? null, r.numero);
    if (existing.has(k)) { puladas++; continue; }
    existing.add(k);
    const alternatives = (r.alternativas ?? []).map((a: { key?: string; text?: string } | string, i: number) =>
      typeof a === "string" ? { key: "ABCDE"[i], text: a } : { key: a.key ?? "ABCDE"[i], text: a.text ?? "" });
    const title = String(r.titulo || r.enunciado).replace(/\s+/g, " ").slice(0, 140);
    const notes = [r.qualidade === "revisar" ? "Revisar: extração automática com baixa confiança." : null, r.tem_figura ? "Tem figura/imagem na prova original." : null, r.notas].filter(Boolean).join(" ");
    const cl = classificar({ subject: r.disciplina ?? "interdisciplinar", title, statement: r.enunciado, alternatives });
    batch.push({
      institution: nomeBanca(r.instituicao), exam: r.exam, year: r.ano, phase: r.fase ?? null, booklet: r.versao ?? null, number: r.numero, page: r.pagina ?? null,
      sourceUrl: r.url_prova ?? null, subject: cl.subject, tema: cl.tema, series: cl.series, title, statement: r.enunciado, alternatives,
      answer: r.gabarito ?? null, answerSource: r.url_gabarito ?? null, status: "curation",
      licenseNote: `Extração automática de prova oficial pública. Requer curadoria antes de liberar.${notes ? " " + notes : ""}`,
      searchNorm: searchNormOf({ title, statement: r.enunciado, alternatives, institution: nomeBanca(r.instituicao), exam: r.exam, year: r.ano, extra: cl.tema }),
    });
  }
}
let inseridas = 0;
for (let i = 0; i < batch.length; i += 200) { await db.insert(questions).values(batch.slice(i, i + 200)); inseridas += Math.min(200, batch.length - i); }
console.log(`Linhas lidas: ${lidas} · inseridas: ${inseridas} · puladas (duplicadas/incompletas): ${puladas}`);
