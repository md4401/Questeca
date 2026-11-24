/**
 * Preenche tema e série indicada das questões do banco com regras determinísticas (sem IA) e atualiza o texto de busca.
 * Uso: pnpm db:classificar [--tudo]   (sem --tudo, só questões sem tema)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, isNull } from "drizzle-orm";
import { questions } from "../src/db/schema";
import { classificar } from "../src/lib/core/classificacao";
import { searchNormOf } from "../src/lib/core/search";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;
else if (process.env.NEON_FETCH_VIA_HOST === "1") neonConfig.fetchEndpoint = `https://${new URL(url).host}/sql`;
const db = drizzle(neon(url));

const tudo = process.argv.includes("--tudo");
const rows = tudo ? await db.select().from(questions) : await db.select().from(questions).where(isNull(questions.tema));
let n = 0; const porTema = new Map<string, number>();
for (const q of rows) {
  if (!q.statement && q.status === "reference_only") continue;
  const c = classificar({ subject: q.subject, title: q.title, statement: q.statement, alternatives: q.alternatives });
  porTema.set(c.tema, (porTema.get(c.tema) ?? 0) + 1);
  await db.update(questions).set({ tema: c.tema, series: c.series, subject: c.subject, searchNorm: searchNormOf({ title: q.title, statement: q.statement, alternatives: q.alternatives, institution: q.institution, exam: q.exam, year: q.year, extra: c.tema }) }).where(eq(questions.id, q.id));
  n++;
}
console.log(`Classificadas: ${n}`);
console.log([...porTema.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t, k]) => `  ${k}\t${t}`).join("\n"));
