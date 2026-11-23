/**
 * Importa o catálogo de escolas a partir dos microdados do Censo Escolar (Inep).
 *
 *   1. Baixe o arquivo "microdados_censo_escolar_AAAA.zip" em
 *      https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar
 *   2. DATABASE_URL=... pnpm tsx scripts/import-schools.ts caminho/microdados_censo_escolar_2024.zip 2024
 *      (aceita também o CSV extraído "microdados_ed_basica_AAAA.csv")
 *
 * Idempotente: reexecutar atualiza por código Inep. Só entram escolas em atividade com anos finais do
 * fundamental ou ensino médio. Dados públicos; registre a origem e o ano (colunas source/source_year).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import Papa from "papaparse";
import { schools } from "../src/db/schema";
import { toSchool, missingColumns, type SchoolRow } from "../src/lib/core/schools-import";

const [file, yearArg] = process.argv.slice(2);
if (!file) { console.error("uso: tsx scripts/import-schools.ts <zip|csv> [ano]"); process.exit(1); }
const url = process.env.DATABASE_URL; if (!url) throw new Error("DATABASE_URL ausente");
if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${new URL(url).host}/sql`;
const db = drizzle(neon(url));
const year = Number(yearArg) || new Date().getFullYear() - 1;

function source(): NodeJS.ReadableStream {
  if (!file.toLowerCase().endsWith(".zip")) return createReadStream(file);
  // extrai só o CSV principal, sem descompactar tudo no disco
  const p = spawn("unzip", ["-p", file, "*microdados_ed_basica*.csv"], { stdio: ["ignore", "pipe", "inherit"] });
  return p.stdout;
}

let batch: SchoolRow[] = []; let total = 0; let skipped = 0; let checked = false;
async function flush() {
  if (!batch.length) return;
  const rows = batch; batch = [];
  await db.insert(schools).values(rows.map((r) => ({ ...r, source: "Inep — Censo Escolar", sourceYear: year })))
    .onConflictDoUpdate({ target: schools.inepCode, set: { name: sql`excluded.name`, nameNorm: sql`excluded.name_norm`, city: sql`excluded.city`, cityNorm: sql`excluded.city_norm`, uf: sql`excluded.uf`, neighborhood: sql`excluded.neighborhood`, dependency: sql`excluded.dependency`, sourceYear: sql`excluded.source_year` } });
  total += rows.length;
  if (total % 10000 < 1000) console.log(`${total} escolas…`);
}

await new Promise<void>((resolve, reject) => {
  const stream = source();
  const parser = Papa.parse(Papa.NODE_STREAM_INPUT, { header: true, delimiter: ";", skipEmptyLines: true, encoding: "latin1" } as never);
  stream.pipe(parser as never);
  (parser as unknown as NodeJS.ReadableStream).on("data", async function (this: NodeJS.ReadableStream, r: Record<string, string>) {
    if (!checked) {
      checked = true;
      const miss = missingColumns(Object.keys(r));
      if (miss.length) { reject(new Error(`Colunas ausentes: ${miss.join(", ")}. Colunas encontradas: ${Object.keys(r).slice(0, 40).join(", ")}`)); return; }
    }
    const s = toSchool(r);
    if (!s) { skipped++; return; }
    batch.push(s);
    if (batch.length >= 1000) { this.pause(); try { await flush(); } catch (e) { reject(e as Error); return; } this.resume(); }
  }).on("end", () => flush().then(resolve, reject)).on("error", reject);
});
console.log(`Concluído: ${total} escolas importadas, ${skipped} ignoradas (inativas, fora do EF/EM ou inválidas).`);
